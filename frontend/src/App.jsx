import jsPDF from 'jspdf';
import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [mode, setMode] = useState('signup');
  const [step, setStep] = useState('form');
  const [activeSection, setActiveSection] = useState('personal');

  const [formData, setFormData] = useState({
    name: '', parent_name: '', address: '', mobile: '', email: ''
  });

  const [loginData, setLoginData] = useState({ registration_number: '', password: '' });
  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  const [personalData, setPersonalData] = useState({
    govt_id_type: 'Aadhar',
    govt_id_number: '',
    identity_mark: '',
    current_village: '',
    current_post_office: '',
    current_district: '',
    current_state: '',
    current_pincode: '',
    permanent_village: '',
    permanent_post_office: '',
    permanent_district: '',
    permanent_state: '',
    permanent_pincode: ''
  });
  const [sameAsCurrent, setSameAsCurrent] = useState(false);

  const [educationData, setEducationData] = useState({
    tenth_school: '', tenth_board: '', tenth_percentage: '', tenth_year: '',
    twelfth_school: '', twelfth_board: '', twelfth_percentage: '', twelfth_year: '',
    graduation_university: '', graduation_course: '', graduation_percentage: '', graduation_year: ''
  });

  const [documentFiles, setDocumentFiles] = useState({
    marksheet_10th: null,
    marksheet_12th: null,
    aadhar: null,
    photo: null,
    signature: null
  });
  const [previews, setPreviews] = useState({ photo: null, signature: null });
  const [uploadedDocs, setUploadedDocs] = useState({});

  const [fullProfile, setFullProfile] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [student, setStudent] = useState(null);
  const [generatedPassword, setGeneratedPassword] = useState('');

  const isLocked = student?.final_submitted;

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleLoginChange = (e) => setLoginData({ ...loginData, [e.target.name]: e.target.value });
  const handlePasswordChange = (e) => setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  const handlePersonalChange = (e) => setPersonalData({ ...personalData, [e.target.name]: e.target.value });
  const handleEducationChange = (e) => setEducationData({ ...educationData, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    const fieldName = e.target.name;
    setDocumentFiles({ ...documentFiles, [fieldName]: file });

    if ((fieldName === 'photo' || fieldName === 'signature') && file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviews(prev => ({ ...prev, [fieldName]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSameAddressToggle = (e) => {
    const checked = e.target.checked;
    setSameAsCurrent(checked);
    if (checked) {
      setPersonalData({
        ...personalData,
        permanent_village: personalData.current_village,
        permanent_post_office: personalData.current_post_office,
        permanent_district: personalData.current_district,
        permanent_state: personalData.current_state,
        permanent_pincode: personalData.current_pincode
      });
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('https://featurelab-portal.onrender.com/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Something went wrong'); return; }
      setStep('otp');
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('https://featurelab-portal.onrender.com/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: formData.mobile, otp })
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Verification failed'); return; }
      setStudent(data.student);
      setGeneratedPassword(data.generatedPassword);
      setStep('success');
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('https://featurelab-portal.onrender.com/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Login failed'); return; }
      setStudent(data.student);
      setStep('dashboard');
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    try {
      const response = await fetch('https://featurelab-portal.onrender.com/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_number: student.registration_number,
          oldPassword: passwordData.oldPassword,
          newPassword: passwordData.newPassword
        })
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Failed to change password'); return; }
      alert('Password changed successfully!');
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  const handlePersonalSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('https://featurelab-portal.onrender.com/personal-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_number: student.registration_number, ...personalData })
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Failed to save details'); return; }
      setStudent(data.student);
      alert('Personal details saved successfully!');
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  const handleEducationSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await fetch('https://featurelab-portal.onrender.com/education-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_number: student.registration_number, ...educationData })
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Failed to save education details'); return; }
      alert('Education details saved successfully!');
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  const fetchUploadedDocs = async () => {
    try {
      const response = await fetch(`https://featurelab-portal.onrender.com/documents/${student.registration_number}`);
      const data = await response.json();
      const docsMap = {};
      data.forEach(doc => { docsMap[doc.doc_type] = doc.file_path; });
      setUploadedDocs(docsMap);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDocumentSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const formPayload = new FormData();
    formPayload.append('registration_number', student.registration_number);

    let hasFile = false;
    for (const key in documentFiles) {
      if (documentFiles[key]) {
        formPayload.append(key, documentFiles[key]);
        hasFile = true;
      }
    }

    if (!hasFile) {
      setError('Please select at least one file to upload');
      return;
    }

    try {
      const response = await fetch('https://featurelab-portal.onrender.com/upload-documents', {
        method: 'POST',
        body: formPayload
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to upload documents');
        return;
      }

      alert('Documents uploaded successfully!');
      fetchUploadedDocs();
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  const fetchFullProfile = async () => {
    try {
      const response = await fetch(`https://featurelab-portal.onrender.com/full-profile/${student.registration_number}`);
      const data = await response.json();
      if (response.ok) {
        setFullProfile(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ===================== RAZORPAY PAYMENT =====================
  const RAZORPAY_KEY_ID = 'rzp_test_TEteiP4D1X4Gep';

  const fetchPaymentStatus = async () => {
    try {
      const response = await fetch(`https://featurelab-portal.onrender.com/payment-status/${student.registration_number}`);
      const data = await response.json();
      if (response.ok) {
        setPaymentStatus(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePayment = async () => {
    setError('');
    try {
      const orderResponse = await fetch('https://featurelab-portal.onrender.com/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_number: student.registration_number })
      });
      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        setError(orderData.error || 'Could not start payment');
        return;
      }

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'FutureLab',
        description: 'Scholarship Application Fee',
        order_id: orderData.order.id,
        handler: async (response) => {
          try {
            const verifyResponse = await fetch('https://featurelab-portal.onrender.com/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                registration_number: student.registration_number,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok) {
              setError(verifyData.error || 'Payment verification failed');
              return;
            }

            alert('Payment successful!');
            fetchPaymentStatus();
          } catch (err) {
            console.error(err);
            setError('Could not verify payment. If money was deducted, contact support.');
          }
        },
        prefill: {
          name: student.name,
          contact: student.mobile,
          email: student.email || ''
        },
        theme: { color: '#f97316' }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  const handleFinalSubmit = async () => {
    if (!agreed) {
      setError('You must accept the declaration before submitting.');
      return;
    }

    if (!window.confirm('Once submitted, you will NOT be able to edit your details. Are you sure you want to proceed?')) {
      return;
    }

    setError('');

    try {
      const response = await fetch('https://featurelab-portal.onrender.com/final-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_number: student.registration_number, agreed })
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Failed to submit'); return; }

      setStudent(data.student);
      alert('Application submitted successfully! Your profile is now locked.');
    } catch (err) {
      console.error(err);
      setError('Could not connect to server');
    }
  };

  // Fetches a student's uploaded photo/signature from the backend and converts it
  // to a data URL that jsPDF can embed. Returns null if not uploaded, unreachable,
  // or uploaded as a PDF (only image files can be embedded inline).
  const loadDocumentImage = async (documents, docType) => {
    const docEntry = documents.find(d => d.doc_type === docType);
    if (!docEntry) return null;
    try {
      const cleanPath = docEntry.file_path.replace(/\\/g, '/');
      const url = `https://featurelab-portal.onrender.com/${cleanPath}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) return null; // e.g. submitted as PDF
      const format = blob.type === 'image/png' ? 'PNG' : 'JPEG';
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return { dataUrl, format };
    } catch (err) {
      console.error(`Could not load ${docType} for PDF:`, err);
      return null;
    }
  };

  // ===================== STRUCTURED PDF GENERATION =====================
  const downloadPDF = async () => {
    if (!fullProfile) return;

    const doc = new jsPDF();
    const student = fullProfile.student;
    const education = fullProfile.education;
    const documents = fullProfile.documents;

    const photoImage = await loadDocumentImage(documents, 'photo');
    const signatureImage = await loadDocumentImage(documents, 'signature');

    const pageWidth = 210;
    const marginX = 14;
    const contentWidth = pageWidth - marginX * 2; // 182
    let y = 0;

    const docLabels = {
      marksheet_10th: '10th Marksheet',
      marksheet_12th: '12th Marksheet',
      aadhar: 'Aadhaar Card',
      photo: 'Photo',
      signature: 'Signature'
    };

    const checkPageBreak = (needed) => {
      if (y + needed > 280) {
        doc.addPage();
        y = 20;
      }
    };

    const sectionHeader = (title) => {
      checkPageBreak(16);
      doc.setFillColor(255, 247, 237);
      doc.setDrawColor(249, 115, 22);
      doc.setLineWidth(0.3);
      doc.rect(marginX, y, contentWidth, 8, 'FD');
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      doc.setTextColor(154, 52, 18);
      doc.text(title, marginX + 4, y + 5.5);
      doc.setFont(undefined, 'normal');
      y += 8 + 5;
    };

    // 2-column key/value grid. Pass array of [label, value]
    const keyValueGrid = (pairs) => {
      const colWidth = contentWidth / 2;
      const rowHeight = 14;
      for (let i = 0; i < pairs.length; i += 2) {
        checkPageBreak(rowHeight);
        const rowPairs = pairs.slice(i, i + 2);
        rowPairs.forEach(([label, value], idx) => {
          const x = marginX + idx * colWidth;
          doc.setDrawColor(225, 225, 225);
          doc.setLineWidth(0.2);
          doc.rect(x, y, colWidth, rowHeight);
          doc.setFontSize(7.5);
          doc.setTextColor(130, 130, 130);
          doc.text(label.toUpperCase(), x + 3, y + 5);
          doc.setFontSize(10);
          doc.setTextColor(25, 25, 25);
          doc.setFont(undefined, 'bold');
          const val = doc.splitTextToSize(value || '-', colWidth - 6)[0];
          doc.text(val, x + 3, y + 10.5);
          doc.setFont(undefined, 'normal');
        });
        y += rowHeight;
      }
      y += 4;
    };

    // Full-width single row (for long text like addresses)
    const fullWidthRow = (label, value) => {
      const text = value || '-';
      const lines = doc.splitTextToSize(text, contentWidth - 6);
      const rowHeight = 8 + lines.length * 5;
      checkPageBreak(rowHeight);
      doc.setDrawColor(225, 225, 225);
      doc.setLineWidth(0.2);
      doc.rect(marginX, y, contentWidth, rowHeight);
      doc.setFontSize(7.5);
      doc.setTextColor(130, 130, 130);
      doc.text(label.toUpperCase(), marginX + 3, y + 5);
      doc.setFontSize(10);
      doc.setTextColor(25, 25, 25);
      doc.setFont(undefined, 'bold');
      doc.text(lines, marginX + 3, y + 10.5);
      doc.setFont(undefined, 'normal');
      y += rowHeight + 4;
    };

    // Single-column field list — used next to the photo/signature panel where
    // full-width 2-column rows would be too wide.
    const fieldStack = (pairs, x, width, startY) => {
      const rowHeight = 12;
      let localY = startY;
      pairs.forEach(([label, value]) => {
        doc.setDrawColor(225, 225, 225);
        doc.setLineWidth(0.2);
        doc.rect(x, localY, width, rowHeight);
        doc.setFontSize(7.5);
        doc.setTextColor(130, 130, 130);
        doc.text(label.toUpperCase(), x + 3, localY + 4.5);
        doc.setFontSize(10);
        doc.setTextColor(25, 25, 25);
        doc.setFont(undefined, 'bold');
        const val = doc.splitTextToSize(value || '-', width - 6)[0];
        doc.text(val, x + 3, localY + 9.5);
        doc.setFont(undefined, 'normal');
        localY += rowHeight;
      });
      return localY;
    };

    // Bordered box with a small label bar on top, used for the photo and
    // signature images. Falls back to "Not Available" text if no image.
    const imageBox = (label, image, x, boxY, width, height) => {
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.rect(x, boxY, width, height);
      doc.setFillColor(250, 250, 250);
      doc.rect(x, boxY, width, 5, 'F');
      doc.setDrawColor(210, 210, 210);
      doc.rect(x, boxY, width, 5);
      doc.setFontSize(6.5);
      doc.setTextColor(130, 130, 130);
      doc.text(label.toUpperCase(), x + 2, boxY + 3.5);

      const imgY = boxY + 5;
      const imgH = height - 5;
      if (image) {
        const pad = 1.5;
        try {
          doc.addImage(image.dataUrl, image.format, x + pad, imgY + pad, width - pad * 2, imgH - pad * 2);
        } catch (err) {
          console.error(`Could not embed ${label} image:`, err);
        }
      } else {
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.text('Not Available', x + width / 2, imgY + imgH / 2, { align: 'center' });
      }
    };

    // Simple bordered table with a shaded header row (for education)
    const drawTable = (headers, colWidths, rows) => {
      checkPageBreak(9);
      let x = marginX;
      doc.setFillColor(249, 115, 22);
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      headers.forEach((h, i) => {
        doc.rect(x, y, colWidths[i], 9, 'F');
        doc.text(h, x + 2, y + 6);
        x += colWidths[i];
      });
      doc.setFont(undefined, 'normal');
      y += 9;

      const rowHeight = 16;
      rows.forEach((row) => {
        checkPageBreak(rowHeight);
        x = marginX;
        row.forEach((cell, i) => {
          doc.setDrawColor(225, 225, 225);
          doc.setLineWidth(0.2);
          doc.rect(x, y, colWidths[i], rowHeight);
          doc.setFontSize(8.5);
          doc.setTextColor(25, 25, 25);
          const lines = doc.splitTextToSize(cell || '-', colWidths[i] - 4);
          doc.text(lines.slice(0, 2), x + 2, y + 6);
          x += colWidths[i];
        });
        y += rowHeight;
      });
      y += 6;
    };

    // ---------- HEADER BANNER ----------
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text('FutureLab', marginX, 16);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('Scholarship Application Summary', marginX, 23);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - marginX, 23, { align: 'right' });

    y = 38;

    // ---------- REGISTRATION NUMBER STRIP ----------
    doc.setFillColor(250, 245, 255);
    doc.setDrawColor(196, 181, 253);
    doc.setLineWidth(0.3);
    doc.rect(marginX, y, contentWidth, 12, 'FD');
    doc.setFontSize(9);
    doc.setTextColor(107, 33, 168);
    doc.text('REGISTRATION NUMBER', marginX + 4, y + 5);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(student.registration_number, marginX + 4, y + 10);
    doc.setFont(undefined, 'normal');
    y += 12 + 8;

    // ---------- PERSONAL DETAILS ----------
    sectionHeader('Personal Details');

    const photoW = 40, photoH = 48, sigH = 22, panelGap = 4, colGap = 6;
    const rightColX = marginX + contentWidth - photoW;
    const leftColWidth = contentWidth - photoW - colGap;
    const personalTopY = y;

    const leftEndY = fieldStack([
      ['Name', student.name],
      ["Parent's Name", student.parent_name],
      ['Mobile', student.mobile],
      ['Email', student.email],
      ['Govt ID Type', student.govt_id_type],
      ['Govt ID Number', student.govt_id_number]
    ], marginX, leftColWidth, personalTopY);

    imageBox('Photo', photoImage, rightColX, personalTopY, photoW, photoH);
    imageBox('Signature', signatureImage, rightColX, personalTopY + photoH + panelGap, photoW, sigH);

    y = Math.max(leftEndY, personalTopY + photoH + panelGap + sigH) + 4;

    if (student.identity_mark) fullWidthRow('Identity Mark', student.identity_mark);
    fullWidthRow('Current Address', [student.current_village, student.current_post_office, student.current_district, student.current_state, student.current_pincode].filter(Boolean).join(', '));
    fullWidthRow('Permanent Address', [student.permanent_village, student.permanent_post_office, student.permanent_district, student.permanent_state, student.permanent_pincode].filter(Boolean).join(', '));

    // ---------- EDUCATION DETAILS ----------
    sectionHeader('Education Details');
    if (education) {
      drawTable(
        ['Level', 'Institution', 'Board / Course', '%', 'Year'],
        [26, 68, 56, 16, 16],
        [
          ['10th', education.tenth_school, education.tenth_board, String(education.tenth_percentage ?? '-'), String(education.tenth_year ?? '-')],
          ['12th', education.twelfth_school, education.twelfth_board, String(education.twelfth_percentage ?? '-'), String(education.twelfth_year ?? '-')],
          ['Graduation', education.graduation_university, education.graduation_course, String(education.graduation_percentage ?? '-'), String(education.graduation_year ?? '-')]
        ]
      );
    } else {
      checkPageBreak(12);
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text('No education details submitted.', marginX, y + 5);
      y += 14;
    }

    // ---------- DOCUMENTS UPLOADED ----------
    sectionHeader('Documents Uploaded');
    const docTypesInOrder = ['marksheet_10th', 'marksheet_12th', 'aadhar', 'photo', 'signature'];
    const uploadedTypes = documents.map(d => d.doc_type);
    const colWidth2 = contentWidth / 2;
    const rowH = 10;
    docTypesInOrder.forEach((type, idx) => {
      const col = idx % 2;
      if (col === 0) checkPageBreak(rowH);
      const x = marginX + col * colWidth2;
      const isUploaded = uploadedTypes.includes(type);
      doc.setDrawColor(225, 225, 225);
      doc.setLineWidth(0.2);
      doc.rect(x, y, colWidth2, rowH);
      doc.setFontSize(9);
      doc.setTextColor(25, 25, 25);
      doc.text(docLabels[type] || type, x + 3, y + 6.5);
      if (isUploaded) {
        doc.setTextColor(22, 163, 74);
        doc.setFont(undefined, 'bold');
        doc.text('Uploaded', x + colWidth2 - 3, y + 6.5, { align: 'right' });
      } else {
        doc.setTextColor(200, 60, 60);
        doc.setFont(undefined, 'bold');
        doc.text('Missing', x + colWidth2 - 3, y + 6.5, { align: 'right' });
      }
      doc.setFont(undefined, 'normal');
      if (col === 1) y += rowH;
    });
    if (docTypesInOrder.length % 2 !== 0) y += rowH;
    y += 6;

    // ---------- FOOTER ----------
    checkPageBreak(14);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, marginX + contentWidth, y);
    y += 6;
    doc.setFontSize(8.5);
    doc.setTextColor(140, 140, 140);
    doc.text('This document confirms your locked FutureLab application submission.', marginX, y);

    doc.save(`FutureLab_Application_${student.registration_number}.pdf`);
  };

  useEffect(() => {
    if (step === 'dashboard' && activeSection === 'documents' && student) {
      fetchUploadedDocs();
    }
    if (step === 'dashboard' && activeSection === 'finalSubmit' && student) {
      fetchFullProfile();
    }
    if (step === 'dashboard' && activeSection === 'payment' && student) {
      fetchPaymentStatus();
    }
  }, [activeSection]);

  const switchMode = (newMode) => {
    setMode(newMode);
    setStep('form');
    setError('');
  };

  const logout = () => {
    setStudent(null);
    setStep('form');
    setMode('signup');
    setActiveSection('personal');
  };

  // Shared review/summary block — reused both before submit and after locking,
  // so the user can review the same structured summary before downloading the PDF.
  const renderSummary = () => (
    fullProfile && (
      <div className="summary-section">
        <h3 className="section-title">Personal Details</h3>
        <div className="summary-grid">
          <div><span>Name</span><strong>{fullProfile.student.name}</strong></div>
          <div><span>Parent's Name</span><strong>{fullProfile.student.parent_name}</strong></div>
          <div><span>Mobile</span><strong>{fullProfile.student.mobile}</strong></div>
          <div><span>Email</span><strong>{fullProfile.student.email || '-'}</strong></div>
          <div><span>Govt ID Type</span><strong>{fullProfile.student.govt_id_type || '-'}</strong></div>
          <div><span>Govt ID Number</span><strong>{fullProfile.student.govt_id_number || '-'}</strong></div>
          <div><span>Current Address</span><strong>{[fullProfile.student.current_village, fullProfile.student.current_district, fullProfile.student.current_state].filter(Boolean).join(', ') || '-'}</strong></div>
          <div><span>Permanent Address</span><strong>{[fullProfile.student.permanent_village, fullProfile.student.permanent_district, fullProfile.student.permanent_state].filter(Boolean).join(', ') || '-'}</strong></div>
        </div>

        <h3 className="section-title">Education Details</h3>
        {fullProfile.education ? (
          <div className="summary-grid">
            <div><span>10th School</span><strong>{fullProfile.education.tenth_school || '-'}</strong></div>
            <div><span>10th Percentage</span><strong>{fullProfile.education.tenth_percentage || '-'}</strong></div>
            <div><span>12th School</span><strong>{fullProfile.education.twelfth_school || '-'}</strong></div>
            <div><span>12th Percentage</span><strong>{fullProfile.education.twelfth_percentage || '-'}</strong></div>
          </div>
        ) : <p className="coming-soon">No education details submitted yet.</p>}

        <h3 className="section-title">Documents Uploaded</h3>
        {fullProfile.documents.length > 0 ? (
          <div className="summary-grid">
            {fullProfile.documents.map(doc => (
              <div key={doc.doc_type}><span>{doc.doc_type}</span><strong>✓ Uploaded</strong></div>
            ))}
          </div>
        ) : <p className="coming-soon">No documents uploaded yet.</p>}
      </div>
    )
  );

  // ===================== AUTH SCREENS (before login) =====================
  if (step !== 'dashboard') {
    return (
      <div className="page">
        <div className="card">
          <div className="logo">
            <div className="logo-icon">🚀</div>
            <h1>Future<span>Lab</span></h1>
            <p className="tagline">Scholarships for Tomorrow's Achievers</p>
          </div>

          {error && <div className="error-box">{error}</div>}

          {step === 'form' && (
            <div className="mode-toggle">
              <button className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>New Student? Sign Up</button>
              <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Already Registered? Login</button>
            </div>
          )}

          {mode === 'signup' && step === 'form' && (
            <form onSubmit={handleSignup}>
              <div className="field"><label>Full Name</label><input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="Enter your full name" /></div>
              <div className="field"><label>Parent's Name</label><input type="text" name="parent_name" value={formData.parent_name} onChange={handleChange} required placeholder="Enter parent's name" /></div>
              <div className="field"><label>Address</label><input type="text" name="address" value={formData.address} onChange={handleChange} required placeholder="Village, District, State" /></div>
              <div className="field"><label>Mobile Number</label><input type="text" name="mobile" value={formData.mobile} onChange={handleChange} required placeholder="10-digit mobile number" /></div>
              <div className="field"><label>Email</label><input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="you@example.com" /></div>
              <button type="submit" className="signup-btn">Sign Up →</button>
            </form>
          )}

          {mode === 'signup' && step === 'otp' && (
            <form onSubmit={handleVerifyOtp}>
              <p className="otp-info">We've sent a 4-digit OTP to <strong>{formData.email}</strong></p>
              <div className="field"><label>Enter OTP</label><input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required placeholder="Enter 4-digit OTP" maxLength="4" /></div>
              <button type="submit" className="signup-btn">Verify OTP →</button>
            </form>
          )}

          {mode === 'signup' && step === 'success' && student && (
            <div className="success-box">
              <div className="success-icon">✅</div>
              <h2>Registration Complete!</h2>
              <p>Welcome, <strong>{student.name}</strong></p>
              <div className="reg-number"><span>Your Registration Number</span><strong>{student.registration_number}</strong></div>
              <div className="reg-number"><span>Your Password</span><strong>{generatedPassword}</strong></div>
              <p className="note">⚠️ Please save both carefully. You'll need them to log in later.</p>
              <button className="signup-btn" onClick={() => setStep('dashboard')}>Go to Dashboard →</button>
            </div>
          )}

          {mode === 'login' && step === 'form' && (
            <form onSubmit={handleLogin}>
              <div className="field"><label>Registration Number</label><input type="text" name="registration_number" value={loginData.registration_number} onChange={handleLoginChange} required placeholder="e.g. FL1783762344365" /></div>
              <div className="field"><label>Password</label><input type="password" name="password" value={loginData.password} onChange={handleLoginChange} required placeholder="Enter your password" /></div>
              <button type="submit" className="signup-btn">Login →</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ===================== DASHBOARD (after login) =====================
  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">🚀</span>
          <span className="brand-name">Future<span>Lab</span></span>
        </div>
        <div className="topbar-right">
          <span className="student-name">{student.name}</span>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="dashboard-body">
        <aside className="sidebar">
          <button className={activeSection === 'personal' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('personal')}>
            <span>👤</span> Personal Details
          </button>
          <button className={activeSection === 'education' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('education')}>
            <span>🎓</span> Education Details
          </button>
          <button className={activeSection === 'documents' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('documents')}>
            <span>📄</span> Document Submit
          </button>
          <button className={activeSection === 'payment' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('payment')}>
            <span>💳</span> Payment
          </button>
          <button className={activeSection === 'finalSubmit' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('finalSubmit')}>
            <span>✅</span> Final Submit
          </button>
          <div className="sidebar-divider"></div>
          <button className={activeSection === 'password' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('password')}>
            <span>🔒</span> Change Password
          </button>
        </aside>

        <main className="main-panel">
          {error && <div className="error-box">{error}</div>}
          {isLocked && <div className="locked-banner">🔒 Your application has been submitted and is now locked. No further edits are allowed.</div>}

          <div className="panel-card">
            <div className="reg-strip">
              <span>Registration Number: <strong>{student.registration_number}</strong></span>
            </div>

            {activeSection === 'personal' && (
              <>
                <h2 className="panel-title">Personal Details</h2>
                <fieldset disabled={isLocked} className="fieldset-wrap">
                <form onSubmit={handlePersonalSubmit}>
                  <h3 className="section-title">Identity Details</h3>
                  <div className="form-grid">
                    <div className="field">
                      <label>Government ID Type</label>
                      <select name="govt_id_type" value={personalData.govt_id_type} onChange={handlePersonalChange}>
                        <option value="Aadhar">Aadhar Card</option>
                        <option value="PAN">PAN Card</option>
                        <option value="Voter ID">Voter ID</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>ID Number</label>
                      <input type="text" name="govt_id_number" value={personalData.govt_id_number} onChange={handlePersonalChange} required placeholder="Enter ID number" />
                    </div>
                    <div className="field">
                      <label>Identity Mark</label>
                      <input type="text" name="identity_mark" value={personalData.identity_mark} onChange={handlePersonalChange} placeholder="e.g. mole on left cheek" />
                    </div>
                  </div>

                  <h3 className="section-title">Current Address</h3>
                  <div className="form-grid">
                    <div className="field"><label>Village / Locality</label><input type="text" name="current_village" value={personalData.current_village} onChange={handlePersonalChange} required /></div>
                    <div className="field"><label>Post Office</label><input type="text" name="current_post_office" value={personalData.current_post_office} onChange={handlePersonalChange} required /></div>
                    <div className="field"><label>District</label><input type="text" name="current_district" value={personalData.current_district} onChange={handlePersonalChange} required /></div>
                    <div className="field"><label>State</label><input type="text" name="current_state" value={personalData.current_state} onChange={handlePersonalChange} required /></div>
                    <div className="field"><label>Pincode</label><input type="text" name="current_pincode" value={personalData.current_pincode} onChange={handlePersonalChange} required maxLength="6" /></div>
                  </div>

                  <h3 className="section-title">Permanent Address</h3>
                  <div className="checkbox-field">
                    <input type="checkbox" id="sameAddress" checked={sameAsCurrent} onChange={handleSameAddressToggle} />
                    <label htmlFor="sameAddress">Same as current address</label>
                  </div>

                  {!sameAsCurrent && (
                    <div className="form-grid">
                      <div className="field"><label>Village / Locality</label><input type="text" name="permanent_village" value={personalData.permanent_village} onChange={handlePersonalChange} required /></div>
                      <div className="field"><label>Post Office</label><input type="text" name="permanent_post_office" value={personalData.permanent_post_office} onChange={handlePersonalChange} required /></div>
                      <div className="field"><label>District</label><input type="text" name="permanent_district" value={personalData.permanent_district} onChange={handlePersonalChange} required /></div>
                      <div className="field"><label>State</label><input type="text" name="permanent_state" value={personalData.permanent_state} onChange={handlePersonalChange} required /></div>
                      <div className="field"><label>Pincode</label><input type="text" name="permanent_pincode" value={personalData.permanent_pincode} onChange={handlePersonalChange} required maxLength="6" /></div>
                    </div>
                  )}

                  <button type="submit" className="signup-btn wide">Save Personal Information →</button>
                </form>
                </fieldset>
              </>
            )}

            {activeSection === 'education' && (
              <>
                <h2 className="panel-title">Education Details</h2>
                <fieldset disabled={isLocked} className="fieldset-wrap">
                <form onSubmit={handleEducationSubmit}>

                  <h3 className="section-title">10th Board Details</h3>
                  <div className="form-grid">
                    <div className="field"><label>School Name</label><input type="text" name="tenth_school" value={educationData.tenth_school} onChange={handleEducationChange} required /></div>
                    <div className="field"><label>Board</label><input type="text" name="tenth_board" value={educationData.tenth_board} onChange={handleEducationChange} required placeholder="e.g. Bihar Board, CBSE" /></div>
                    <div className="field"><label>Percentage</label><input type="number" step="0.01" name="tenth_percentage" value={educationData.tenth_percentage} onChange={handleEducationChange} required placeholder="e.g. 78.50" /></div>
                    <div className="field"><label>Year of Passing</label><input type="number" name="tenth_year" value={educationData.tenth_year} onChange={handleEducationChange} required placeholder="e.g. 2022" /></div>
                  </div>

                  <h3 className="section-title">12th Board Details</h3>
                  <div className="form-grid">
                    <div className="field"><label>School / College Name</label><input type="text" name="twelfth_school" value={educationData.twelfth_school} onChange={handleEducationChange} required /></div>
                    <div className="field"><label>Board</label><input type="text" name="twelfth_board" value={educationData.twelfth_board} onChange={handleEducationChange} required placeholder="e.g. Bihar Board, CBSE" /></div>
                    <div className="field"><label>Percentage</label><input type="number" step="0.01" name="twelfth_percentage" value={educationData.twelfth_percentage} onChange={handleEducationChange} required placeholder="e.g. 82.00" /></div>
                    <div className="field"><label>Year of Passing</label><input type="number" name="twelfth_year" value={educationData.twelfth_year} onChange={handleEducationChange} required placeholder="e.g. 2024" /></div>
                  </div>

                  <h3 className="section-title">Graduation Details (if applicable)</h3>
                  <div className="form-grid">
                    <div className="field"><label>University Name</label><input type="text" name="graduation_university" value={educationData.graduation_university} onChange={handleEducationChange} placeholder="e.g. Patna University" /></div>
                    <div className="field"><label>Course</label><input type="text" name="graduation_course" value={educationData.graduation_course} onChange={handleEducationChange} placeholder="e.g. B.Sc, B.A" /></div>
                    <div className="field"><label>Percentage</label><input type="number" step="0.01" name="graduation_percentage" value={educationData.graduation_percentage} onChange={handleEducationChange} placeholder="e.g. 70.00" /></div>
                    <div className="field"><label>Year of Passing</label><input type="number" name="graduation_year" value={educationData.graduation_year} onChange={handleEducationChange} placeholder="e.g. 2027" /></div>
                  </div>

                  <button type="submit" className="signup-btn wide">Save Education Details →</button>
                </form>
                </fieldset>
              </>
            )}

            {activeSection === 'documents' && (
              <>
                <h2 className="panel-title">Document Submit</h2>
                <fieldset disabled={isLocked} className="fieldset-wrap">
                <form onSubmit={handleDocumentSubmit}>
                  <div className="form-grid">
                    <div className="field">
                      <label>10th Marksheet (PDF only, max 800KB) {uploadedDocs.marksheet_10th && <span className="uploaded-tag">✓ Uploaded</span>}</label>
                      <input type="file" name="marksheet_10th" accept=".pdf" onChange={handleFileChange} />
                    </div>

                    <div className="field">
                      <label>12th Marksheet (PDF only, max 800KB) {uploadedDocs.marksheet_12th && <span className="uploaded-tag">✓ Uploaded</span>}</label>
                      <input type="file" name="marksheet_12th" accept=".pdf" onChange={handleFileChange} />
                    </div>

                    <div className="field">
                      <label>Aadhaar Card (PDF/JPG, max 800KB) {uploadedDocs.aadhar && <span className="uploaded-tag">✓ Uploaded</span>}</label>
                      <input type="file" name="aadhar" accept=".jpg,.jpeg,.pdf" onChange={handleFileChange} />
                    </div>

                    <div className="field">
                      <label>Photo (Passport size, JPG/PDF, max 300KB) {uploadedDocs.photo && <span className="uploaded-tag">✓ Uploaded</span>}</label>
                      <input type="file" name="photo" accept=".jpg,.jpeg,.pdf" onChange={handleFileChange} />
                      {previews.photo && <img src={previews.photo} alt="Photo preview" className="preview-img photo-preview" />}
                    </div>

                    <div className="field">
                      <label>Signature (JPG only, max 200KB) {uploadedDocs.signature && <span className="uploaded-tag">✓ Uploaded</span>}</label>
                      <input type="file" name="signature" accept=".jpg,.jpeg" onChange={handleFileChange} />
                      {previews.signature && <img src={previews.signature} alt="Signature preview" className="preview-img signature-preview" />}
                    </div>
                  </div>

                  <p className="note">Please follow size limits strictly — oversized files will be rejected automatically.</p>

                  <button type="submit" className="signup-btn wide">Upload Documents →</button>
                </form>
                </fieldset>
              </>
            )}

            {activeSection === 'payment' && (
              <>
                <h2 className="panel-title">Payment</h2>
                {paymentStatus?.paid ? (
                  <div className="success-box">
                    <div className="success-icon">✅</div>
                    <h3>Payment Completed</h3>
                    <p>Your application fee of ₹{paymentStatus.payment?.amount ?? 200} has been paid successfully.</p>
                  </div>
                ) : (
                  <>
                    <p className="note">Scholarship application fee: ₹200 (one-time).</p>
                    <button className="signup-btn wide" onClick={handlePayment}>Pay ₹200 →</button>
                  </>
                )}
              </>
            )}

            {activeSection === 'finalSubmit' && (
              <>
                <h2 className="panel-title">Final Submit</h2>

                {isLocked ? (
                  <div className="locked-confirmation">
                    <div className="success-icon">🔒</div>
                    <h3>Your application has been finally submitted.</h3>
                    <p>No further changes can be made. Review your submitted details below, then download your application PDF.</p>

                    {renderSummary()}

                    <button className="signup-btn wide" onClick={downloadPDF}>📄 Download Application PDF</button>
                  </div>
                ) : (
                  <>
                    {renderSummary()}

                    <div className="agreement-box">
                      <div className="checkbox-field">
                        <input type="checkbox" id="agree" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                        <label htmlFor="agree">
                          I hereby declare that all the information provided above is true and correct to the best of my knowledge.
                          I understand that once submitted, I will not be able to edit any of my details.
                        </label>
                      </div>
                    </div>

                    <div className="final-actions">
                      <button type="button" className="secondary-btn" onClick={() => setActiveSection('personal')}>Edit Details</button>
                      <button type="button" className="signup-btn wide" onClick={handleFinalSubmit}>Final Submit →</button>
                    </div>
                  </>
                )}
              </>
            )}

            {activeSection === 'password' && (
              <>
                <h2 className="panel-title">Change Password</h2>
                <form onSubmit={handleChangePassword}>
                  <div className="form-grid">
                    <div className="field"><label>Current Password</label><input type="password" name="oldPassword" value={passwordData.oldPassword} onChange={handlePasswordChange} required /></div>
                    <div className="field"><label>New Password</label><input type="password" name="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} required /></div>
                    <div className="field"><label>Confirm New Password</label><input type="password" name="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} required /></div>
                  </div>
                  <button type="submit" className="signup-btn wide">Update Password →</button>
                </form>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;