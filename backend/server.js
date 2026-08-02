require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Razorpay client — reads keys from backend/.env (never exposed to the frontend)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const APPLICATION_FEE_RUPEES = 200;

// Email OTP — Nodemailer + Gmail App Password (no DLT registration needed, unlike SMS)
const emailTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  family: 4, // force IPv4 — Render's free tier can't reach Gmail's IPv6 SMTP address
  auth: {
    user: process.env.EMAIL_USER,
  
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

async function sendOtpEmail(email, otp) {
  const { error } = await resend.emails.send({
    from: 'FutureLab <onboarding@resend.dev>',
    to: email,
    subject: 'Your FutureLab Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #f97316;">FutureLab</h2>
        <p>Your verification code is:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
        <p style="color: #777; font-size: 13px;">This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `
  });

  if (error) {
    throw new Error(error.message || 'Failed to send OTP email');
  }
}


// Temporary in-memory store for OTPs
const otpStore = new Map();

// ===================== ADMIN AUTH =====================
let currentAdminToken = null; // single-admin, in-memory session (resets on server restart)

function requireAdmin(req, res, next) {
  const token = req.headers['admin-token'];
  if (!token || token !== currentAdminToken) {
    return res.status(401).json({ error: 'Not authorized. Please log in again.' });
  }
  next();
}

// File rules per document type
const FILE_RULES = {
  marksheet_10th: { maxSize: 800 * 1024, types: /pdf/ },
  marksheet_12th: { maxSize: 800 * 1024, types: /pdf/ },
  aadhar: { maxSize: 800 * 1024, types: /pdf|jpeg|jpg/ },
  photo: { maxSize: 300 * 1024, types: /jpeg|jpg|pdf/ },
  signature: { maxSize: 200 * 1024, types: /jpeg|jpg/ }
};

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.fieldname + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 800 * 1024 },
  fileFilter: (req, file, cb) => {
    const rule = FILE_RULES[file.fieldname];
    if (!rule) return cb(new Error('Unknown document type'));

    const ext = rule.types.test(path.extname(file.originalname).toLowerCase());
    if (!ext) {
      return cb(new Error(`${file.fieldname} must be one of: ${rule.types.source.replace(/\|/g, ', ')}`));
    }
    cb(null, true);
  }
});

// Test route
app.get('/', (req, res) => {
  res.send('FutureLab backend is running 🚀');
});

// Route to get all students
app.get('/students', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Route to create a new student (Step 1: basic signup, before OTP verification)
// FIXED: previously this always ran a raw INSERT, so any incomplete/abandoned
// signup attempt (e.g. email send was slow or failed) would leave a row behind
// with is_verified = false, permanently blocking that mobile number on retry
// with a misleading "already registered" error. Now it checks for an existing
// row first: verified rows are correctly rejected, but unverified/incomplete
// rows are updated in place and get a fresh OTP instead of colliding.
app.post('/students', async (req, res) => {
  const { name, parent_name, address, mobile, email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required for OTP verification.' });
  }

  try {
    const existing = await pool.query(
      'SELECT * FROM students WHERE mobile = $1',
      [mobile]
    );

    let student;

    if (existing.rows.length > 0) {
      const existingStudent = existing.rows[0];

      if (existingStudent.is_verified) {
        return res.status(400).json({ error: 'This mobile number is already registered.' });
      }

      // Incomplete signup from before — update details and resend OTP instead of inserting a new row
      const updateResult = await pool.query(
        `UPDATE students SET name = $1, parent_name = $2, address = $3, email = $4
         WHERE mobile = $5 RETURNING *`,
        [name, parent_name, address, email, mobile]
      );
      student = updateResult.rows[0];
    } else {
      const insertResult = await pool.query(
        `INSERT INTO students (name, parent_name, address, mobile, email)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, parent_name, address, mobile, email]
      );
      student = insertResult.rows[0];
    }

    const otp = Math.floor(1000 + Math.random() * 9000);
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(mobile, { otp, expiresAt });
    await sendOtpEmail(email, otp);

    res.status(201).json({
      message: 'Signup successful. OTP sent for verification.',
      student
    });
  } catch (err) {
    console.error(err.message);

    if (err.code === '23505') {
      return res.status(400).json({ error: 'This mobile number is already registered.' });
    }

    res.status(500).json({ error: 'Server error, please try again later.' });
  }
});

// Generate and "send" OTP manually (optional, for re-requesting OTP)
app.post('/send-otp', async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return res.status(400).json({ error: 'Mobile number is required' });
  }

  try {
    const studentResult = await pool.query(
      'SELECT email FROM students WHERE mobile = $1',
      [mobile]
    );

    if (studentResult.rows.length === 0 || !studentResult.rows[0].email) {
      return res.status(404).json({ error: 'No email found for this mobile number.' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000);
    const expiresAt = Date.now() + 5 * 60 * 1000;
    otpStore.set(mobile, { otp, expiresAt });
    await sendOtpEmail(studentResult.rows[0].email, otp);
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Send OTP error:', err.message);
    res.status(500).json({ error: 'Could not send OTP. Please try again.' });
  }
});

// Verify OTP and finalize registration
app.post('/verify-otp', async (req, res) => {
  const { mobile, otp } = req.body;

  const record = otpStore.get(mobile);

  if (!record) {
    return res.status(400).json({ error: 'No OTP found for this mobile. Please request again.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(mobile);
    return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
  }

  if (parseInt(otp) !== record.otp) {
    return res.status(400).json({ error: 'Incorrect OTP' });
  }

  otpStore.delete(mobile);

  try {
    const regNumber = 'FL' + Date.now();
    const rawPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const result = await pool.query(
      `UPDATE students 
       SET is_verified = true, registration_number = $1, password = $2
       WHERE mobile = $3
       RETURNING *`,
      [regNumber, hashedPassword, mobile]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found for this mobile number' });
    }

    const student = result.rows[0];
    delete student.password;

    res.json({
      message: 'OTP verified successfully. Registration complete!',
      student,
      generatedPassword: rawPassword
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message || 'Server error verifying OTP.' });
  }
});

// Login with registration number + password
app.post('/login', async (req, res) => {
  const { registration_number, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE registration_number = $1',
      [registration_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid registration number or password' });
    }

    const student = result.rows[0];
    const match = await bcrypt.compare(password, student.password);

    if (!match) {
      return res.status(401).json({ error: 'Invalid registration number or password' });
    }

    delete student.password;
    res.json({ message: 'Login successful', student });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
});

// Change password (after login)
app.post('/change-password', async (req, res) => {
  const { registration_number, oldPassword, newPassword } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM students WHERE registration_number = $1',
      [registration_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = result.rows[0];
    const match = await bcrypt.compare(oldPassword, student.password);

    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE students SET password = $1 WHERE registration_number = $2',
      [hashedNewPassword, registration_number]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
});

// Update personal information (identity + address details)
app.post('/personal-details', async (req, res) => {
  const {
    registration_number,
    govt_id_type,
    govt_id_number,
    identity_mark,
    current_village,
    current_post_office,
    current_district,
    current_state,
    current_pincode,
    permanent_village,
    permanent_post_office,
    permanent_district,
    permanent_state,
    permanent_pincode
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE students SET
        govt_id_type = $1,
        govt_id_number = $2,
        identity_mark = $3,
        current_village = $4,
        current_post_office = $5,
        current_district = $6,
        current_state = $7,
        current_pincode = $8,
        permanent_village = $9,
        permanent_post_office = $10,
        permanent_district = $11,
        permanent_state = $12,
        permanent_pincode = $13
      WHERE registration_number = $14
      RETURNING *`,
      [
        govt_id_type, govt_id_number, identity_mark,
        current_village, current_post_office, current_district, current_state, current_pincode,
        permanent_village, permanent_post_office, permanent_district, permanent_state, permanent_pincode,
        registration_number
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = result.rows[0];
    delete student.password;

    res.json({ message: 'Personal details saved successfully', student });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
});

// Save or update education details
app.post('/education-details', async (req, res) => {
  const {
    registration_number,
    tenth_school, tenth_board, tenth_percentage, tenth_year,
    twelfth_school, twelfth_board, twelfth_percentage, twelfth_year,
    graduation_university, graduation_course, graduation_percentage, graduation_year
  } = req.body;

  try {
    const studentResult = await pool.query(
      'SELECT id FROM students WHERE registration_number = $1',
      [registration_number]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentId = studentResult.rows[0].id;

    const existing = await pool.query(
      'SELECT id FROM education_details WHERE student_id = $1',
      [studentId]
    );

    let result;

    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE education_details SET
          tenth_school = $1, tenth_board = $2, tenth_percentage = $3, tenth_year = $4,
          twelfth_school = $5, twelfth_board = $6, twelfth_percentage = $7, twelfth_year = $8,
          graduation_university = $9, graduation_course = $10, graduation_percentage = $11, graduation_year = $12
        WHERE student_id = $13
        RETURNING *`,
        [
          tenth_school, tenth_board, tenth_percentage, tenth_year,
          twelfth_school, twelfth_board, twelfth_percentage, twelfth_year,
          graduation_university, graduation_course, graduation_percentage, graduation_year,
          studentId
        ]
      );
    } else {
      result = await pool.query(
        `INSERT INTO education_details 
          (student_id, tenth_school, tenth_board, tenth_percentage, tenth_year,
           twelfth_school, twelfth_board, twelfth_percentage, twelfth_year,
           graduation_university, graduation_course, graduation_percentage, graduation_year)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          studentId,
          tenth_school, tenth_board, tenth_percentage, tenth_year,
          twelfth_school, twelfth_board, twelfth_percentage, twelfth_year,
          graduation_university, graduation_course, graduation_percentage, graduation_year
        ]
      );
    }

    res.json({ message: 'Education details saved successfully', education: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
});

// Upload documents (10th marksheet, 12th marksheet, aadhar, photo, signature)
app.post('/upload-documents', (req, res, next) => {
  const uploadMiddleware = upload.fields([
    { name: 'marksheet_10th', maxCount: 1 },
    { name: 'marksheet_12th', maxCount: 1 },
    { name: 'aadhar', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
    { name: 'signature', maxCount: 1 }
  ]);

  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err.message);
      return res.status(400).json({ error: err.message || 'File upload failed. Check file size and type.' });
    }
    next();
  });
}, async (req, res) => {
  const { registration_number } = req.body;

  try {
    const studentResult = await pool.query(
      'SELECT id FROM students WHERE registration_number = $1',
      [registration_number]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentId = studentResult.rows[0].id;
    const files = req.files;
    const savedDocs = [];
    const sizeErrors = [];

    for (const docType in files) {
      const file = files[docType][0];
      const rule = FILE_RULES[docType];

      if (file.size > rule.maxSize) {
        fs.unlink(file.path, () => {});
        sizeErrors.push(`${docType} must be under ${rule.maxSize / 1024}KB`);
        continue;
      }

      const filePath = file.path;

      const existing = await pool.query(
        'SELECT id FROM documents WHERE student_id = $1 AND doc_type = $2',
        [studentId, docType]
      );

      let result;
      if (existing.rows.length > 0) {
        result = await pool.query(
          `UPDATE documents SET file_path = $1, uploaded_at = CURRENT_TIMESTAMP
           WHERE student_id = $2 AND doc_type = $3 RETURNING *`,
          [filePath, studentId, docType]
        );
      } else {
        result = await pool.query(
          `INSERT INTO documents (student_id, doc_type, file_path)
           VALUES ($1, $2, $3) RETURNING *`,
          [studentId, docType, filePath]
        );
      }

      savedDocs.push(result.rows[0]);
    }

    if (sizeErrors.length > 0) {
      return res.status(400).json({ error: sizeErrors.join('; ') });
    }

    res.json({ message: 'Documents uploaded successfully', documents: savedDocs });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
});

// Get uploaded documents for a student
app.get('/documents/:registration_number', async (req, res) => {
  const { registration_number } = req.params;

  try {
    const studentResult = await pool.query(
      'SELECT id FROM students WHERE registration_number = $1',
      [registration_number]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentId = studentResult.rows[0].id;
    const result = await pool.query(
      'SELECT doc_type, file_path FROM documents WHERE student_id = $1',
      [studentId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
});
app.get('/full-profile/:registration_number', async (req, res) => {
  const { registration_number } = req.params;

  try {
    const studentResult = await pool.query(
      'SELECT * FROM students WHERE registration_number = $1',
      [registration_number]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentResult.rows[0];
    delete student.password;

    const educationResult = await pool.query(
      'SELECT * FROM education_details WHERE student_id = $1',
      [student.id]
    );

    const documentsResult = await pool.query(
      'SELECT doc_type, file_path FROM documents WHERE student_id = $1',
      [student.id]
    );

    res.json({
      student,
      education: educationResult.rows[0] || null,
      documents: documentsResult.rows
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
});

app.post('/final-submit', async (req, res) => {
  const { registration_number, agreed } = req.body;

  if (!agreed) {
    return res.status(400).json({ error: 'You must accept the declaration to submit.' });
  }

  try {
    const result = await pool.query(
      `UPDATE students SET final_submitted = true 
       WHERE registration_number = $1 
       RETURNING *`,
      [registration_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = result.rows[0];
    delete student.password;

    res.json({ message: 'Application submitted successfully. Your profile is now locked.', student });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
});

// ===================== RAZORPAY PAYMENT ROUTES =====================

// Create a Razorpay order for the ₹200 application fee
app.post('/create-order', async (req, res) => {
  const { registration_number } = req.body;

  try {
    const studentResult = await pool.query(
      'SELECT id FROM students WHERE registration_number = $1',
      [registration_number]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentId = studentResult.rows[0].id;

    const order = await razorpay.orders.create({
      amount: APPLICATION_FEE_RUPEES * 100, // Razorpay expects paise
      currency: 'INR',
      receipt: registration_number
    });

    await pool.query(
      `INSERT INTO payments (student_id, order_id, amount, status)
       VALUES ($1, $2, $3, 'created')`,
      [studentId, order.id, APPLICATION_FEE_RUPEES]
    );

    res.json({ order });
  } catch (err) {
    console.error('Razorpay order error:', err.message);
    res.status(500).json({ error: 'Could not create payment order. Please try again.' });
  }
});

// Verify the payment signature Razorpay sends back after checkout succeeds
app.post('/verify-payment', async (req, res) => {
  const { registration_number, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  try {
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed. Signature mismatch.' });
    }

    await pool.query(
      `UPDATE payments SET payment_id = $1, status = 'paid'
       WHERE order_id = $2`,
      [razorpay_payment_id, razorpay_order_id]
    );

    res.json({ message: 'Payment verified successfully' });
  } catch (err) {
    console.error('Payment verification error:', err.message);
    res.status(500).json({ error: 'Server error verifying payment.' });
  }
});

// Check whether a student has already paid
app.get('/payment-status/:registration_number', async (req, res) => {
  const { registration_number } = req.params;

  try {
    const studentResult = await pool.query(
      'SELECT id FROM students WHERE registration_number = $1',
      [registration_number]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentId = studentResult.rows[0].id;

    const result = await pool.query(
      `SELECT * FROM payments WHERE student_id = $1 AND status = 'paid'
       ORDER BY created_at DESC LIMIT 1`,
      [studentId]
    );

    res.json({ paid: result.rows.length > 0, payment: result.rows[0] || null });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
});

// ===================== ADMIN ROUTES =====================

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  currentAdminToken = crypto.randomBytes(24).toString('hex');
  res.json({ token: currentAdminToken });
});

app.post('/admin/logout', requireAdmin, (req, res) => {
  currentAdminToken = null;
  res.json({ message: 'Logged out' });
});

// List all applications with payment status
app.get('/admin/applications', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.id, s.name, s.parent_name, s.mobile, s.email, s.registration_number,
        s.final_submitted, s.application_status,
        (SELECT status FROM payments WHERE student_id = s.id ORDER BY created_at DESC LIMIT 1) AS payment_status
      FROM students s
      WHERE s.registration_number IS NOT NULL
      ORDER BY s.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error fetching applications.' });
  }
});

// Get one application's full profile (reuses the same data shape as the student's own full-profile view)
app.get('/admin/applications/:registration_number', requireAdmin, async (req, res) => {
  const { registration_number } = req.params;
  try {
    const studentResult = await pool.query(
      'SELECT * FROM students WHERE registration_number = $1',
      [registration_number]
    );
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    const student = studentResult.rows[0];
    delete student.password;

    const educationResult = await pool.query(
      'SELECT * FROM education_details WHERE student_id = $1',
      [student.id]
    );
    const documentsResult = await pool.query(
      'SELECT doc_type, file_path FROM documents WHERE student_id = $1',
      [student.id]
    );

    res.json({
      student,
      education: educationResult.rows[0] || null,
      documents: documentsResult.rows
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Approve or reject an application
app.post('/admin/applications/:registration_number/status', requireAdmin, async (req, res) => {
  const { registration_number } = req.params;
  const { status } = req.body;

  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const result = await pool.query(
      `UPDATE students SET application_status = $1 WHERE registration_number = $2 RETURNING *`,
      [status, registration_number]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    const student = result.rows[0];
    delete student.password;
    res.json({ message: `Application ${status}`, student });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating status.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});