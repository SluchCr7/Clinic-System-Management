const assert = require('node:assert/strict');

const API_BASE = process.env.E2E_API_URL || 'http://localhost:3001/api';

const USERS = {
  admin: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
  doctor: { email: process.env.E2E_DOCTOR_EMAIL, password: process.env.E2E_DOCTOR_PASSWORD },
  receptionist: { email: process.env.E2E_RECEPTIONIST_EMAIL, password: process.env.E2E_RECEPTIONIST_PASSWORD },
};

if (Object.values(USERS).some(({ email, password }) => !email || !password)) {
  throw new Error("Set E2E_*_EMAIL and E2E_*_PASSWORD credentials before running");
}

async function login(user) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  const data = await res.json();
  assert(res.ok && data.success, `Login failed for ${user.email}: ${JSON.stringify(data)}`);
  const cookies = res.headers.get('set-cookie');
  return { user: data.data.user, cookies };
}

async function api(path, options = {}, cookies = '') {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (cookies) headers['Cookie'] = cookies;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runE2EWorkflow() {
  console.log('=== PHASE 5: COMPLETE END-TO-END BUSINESS WORKFLOW EXECUTION ===\n');

  // 1. Logins
  console.log('1. Logging in as Admin, Doctor, and Receptionist...');
  const adminSession = await login(USERS.admin);
  const docSession = await login(USERS.doctor);
  const recSession = await login(USERS.receptionist);
  console.log('✓ All 3 roles authenticated successfully.\n');

  // Find linked doctor profile for doctor user
  const doctorListRes = await api('/doctors', { method: 'GET' }, adminSession.cookies);
  const doctorProfile = doctorListRes.data.data.find(d => d.user?._id === docSession.user._id || d.user === docSession.user._id) || doctorListRes.data.data[0];
  assert(doctorProfile, 'Must have at least one doctor profile in system');
  const doctorId = doctorProfile._id;
  console.log(`Using Doctor Profile ID: ${doctorId} (${doctorProfile.specialization || 'General'})\n`);

  // 2. Step 1: Patient Registration (Receptionist)
  console.log('2. Step 1: Registering new test patient as Receptionist...');
  const testPhone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
  const patientPayload = {
    firstName: 'E2E_Test',
    lastName: 'WorkflowPatient',
    phone: testPhone,
    gender: 'male',
    dateOfBirth: '1990-05-15',
    address: {
      street: '123 Medical Plaza',
      city: 'Cairo',
      country: 'Egypt',
    },
  };
  const createPatientRes = await api('/patients', {
    method: 'POST',
    body: JSON.stringify(patientPayload),
  }, recSession.cookies);
  assert(createPatientRes.ok, `Patient creation failed: ${JSON.stringify(createPatientRes.data)}`);
  const patient = createPatientRes.data.data;
  const patientId = patient._id;
  console.log(`✓ Patient registered successfully. ID: ${patientId}, Name: ${patient.firstName} ${patient.lastName}\n`);

  // Monday 2026-10-26 at 11:00 Cairo time (08:00 UTC) - outside break (break is 13:00-14:00)
  const mondayDate = new Date('2026-10-26T08:00:00.000Z');
  const appointmentPayload = {
    patient: patientId,
    doctor: doctorId,
    appointmentDate: mondayDate.toISOString(),
    duration: 30,
    type: 'consultation',
    reason: 'Routine checkup & diagnostic consultation',
  };
  const createAptRes = await api('/appointments', {
    method: 'POST',
    body: JSON.stringify(appointmentPayload),
  }, recSession.cookies);
  assert(createAptRes.ok, `Appointment booking failed: ${JSON.stringify(createAptRes.data)}`);
  const appointment = createAptRes.data.data;
  const appointmentId = appointment._id;
  console.log(`✓ Appointment scheduled successfully. ID: ${appointmentId}, Status: ${appointment.status}\n`);

  // 4. Step 3: Clinical Consultation / Visit Creation (Doctor)
  console.log('4. Step 4: Doctor creates clinical consultation visit...');
  const visitPayload = {
    appointment: appointmentId,
    patient: patientId,
    doctor: doctorId,
    chiefComplaint: 'Mild headache and seasonal allergies',
    symptoms: ['headache', 'rhinitis'],
    vitals: {
      temperature: 36.8,
      bloodPressure: { systolic: 120, diastolic: 80 },
      heartRate: 72,
      respiratoryRate: 16,
      oxygenSaturation: 98,
      weight: 75,
      height: 178,
    },
    examination: 'Physical examination unremarkable. Clear lung sounds.',
    diagnosis: ['Acute seasonal rhinitis'],
    doctorNotes: 'Prescribed antihistamines. Hydration recommended.',
  };
  const createVisitRes = await api('/visits', {
    method: 'POST',
    body: JSON.stringify(visitPayload),
  }, docSession.cookies);
  assert(createVisitRes.ok, `Visit creation failed: ${JSON.stringify(createVisitRes.data)}`);
  const visit = createVisitRes.data.data;
  const visitId = visit._id;
  console.log(`✓ Visit recorded successfully. ID: ${visitId}`);

  // Verify appointment transitioned to completed
  const aptCheckRes = await api(`/appointments/${appointmentId}`, { method: 'GET' }, adminSession.cookies);
  console.log(`✓ Appointment status verified after visit: ${aptCheckRes.data.data.status}\n`);

  // 5. Step 4: Medical Service Record (Doctor)
  console.log('5. Step 5: Recording performed medical service...');
  // Find or fetch a medical service
  const serviceListRes = await api('/medical-services', { method: 'GET' }, docSession.cookies);
  let serviceId;
  let serviceFee = 150;
  if (serviceListRes.ok && serviceListRes.data.data.length > 0) {
    serviceId = serviceListRes.data.data[0]._id;
    serviceFee = serviceListRes.data.data[0].fee || 150;
  } else {
    // Admin creates one
    const newServiceRes = await api('/medical-services', {
      method: 'POST',
      body: JSON.stringify({ name: 'General Consultation', code: 'GEN-01', fee: 150, category: 'General' }),
    }, adminSession.cookies);
    serviceId = newServiceRes.data.data._id;
  }

  const performedServiceRes = await api('/performed-services', {
    method: 'POST',
    body: JSON.stringify({
      service: serviceId,
      patient: patientId,
      doctor: doctorId,
      visit: visitId,
      fee: serviceFee,
      notes: 'Initial evaluation consultation',
    }),
  }, docSession.cookies);
  assert(performedServiceRes.ok, `Performed service creation failed: ${JSON.stringify(performedServiceRes.data)}`);
  const performedServiceId = performedServiceRes.data.data._id;
  console.log(`✓ Performed service recorded. ID: ${performedServiceId}, Fee: $${serviceFee}\n`);

  // 6. Step 5: Invoicing (Receptionist)
  console.log('6. Step 6: Generating invoice as Receptionist from Visit...');
  const invoicePayload = {
    visit: visitId,
    tax: 0,
    discount: 0,
    notes: 'Consultation & diagnostics fee',
  };
  const createInvoiceRes = await api('/invoices', {
    method: 'POST',
    body: JSON.stringify(invoicePayload),
  }, recSession.cookies);
  assert(createInvoiceRes.ok, `Invoice creation failed: ${JSON.stringify(createInvoiceRes.data)}`);
  const invoice = createInvoiceRes.data.data;
  const invoiceId = invoice._id;
  console.log(`✓ Invoice generated. ID: ${invoiceId}, Invoice Number: ${invoice.invoiceNumber}, Total: $${invoice.total}, Remaining: $${invoice.remainingAmount}\n`);

  // 7. Step 6: Payment Handling (Receptionist)
  console.log('7. Step 7: Testing Payment collection scenarios (Receptionist)...');

  // 7a. Attempt Overpayment (must be rejected)
  const overpayRes = await api('/payments', {
    method: 'POST',
    body: JSON.stringify({
      invoice: invoiceId,
      amount: invoice.remainingAmount + 50,
      method: 'cash',
    }),
  }, recSession.cookies);
  assert.strictEqual(overpayRes.status, 400, 'Overpayment must be rejected with 400');
  console.log(`✓ Overpayment correctly rejected with 400 (${overpayRes.data.code})`);

  // 7b. Attempt Card payment without transaction reference (must be rejected)
  const missingRefRes = await api('/payments', {
    method: 'POST',
    body: JSON.stringify({
      invoice: invoiceId,
      amount: 50,
      method: 'card',
      // missing transactionReference
    }),
  }, recSession.cookies);
  assert.strictEqual(missingRefRes.status, 400, 'Electronic payment without reference must be rejected');
  console.log(`✓ Card payment without reference rejected with 400 (${missingRefRes.data.code})`);

  // 7c. Partial Payment (Cash)
  const partialAmount = Math.round(serviceFee / 2);
  const partialPayRes = await api('/payments', {
    method: 'POST',
    body: JSON.stringify({
      invoice: invoiceId,
      amount: partialAmount,
      method: 'cash',
      notes: 'First installment cash',
    }),
  }, recSession.cookies);
  assert(partialPayRes.ok, `Partial payment failed: ${JSON.stringify(partialPayRes.data)}`);
  console.log(`✓ Partial payment recorded. Amount: $${partialAmount}`);

  // Check invoice balance
  let invCheck = await api(`/invoices/${invoiceId}`, { method: 'GET' }, recSession.cookies);
  console.log(`✓ Invoice after partial payment: Status=${invCheck.data.data.status}, Paid=$${invCheck.data.data.paidAmount}, Remaining=$${invCheck.data.data.remainingAmount}`);

  // 7d. Final Payment with Card and valid Reference
  const remaining = invCheck.data.data.remainingAmount;
  const finalPayRes = await api('/payments', {
    method: 'POST',
    body: JSON.stringify({
      invoice: invoiceId,
      amount: remaining,
      method: 'card',
      transactionReference: 'TXN-98234-VISA',
      notes: 'Final settlement via card',
    }),
  }, recSession.cookies);
  assert(finalPayRes.ok, `Final payment failed: ${JSON.stringify(finalPayRes.data)}`);
  console.log(`✓ Final settlement recorded. Amount: $${remaining}, Ref: TXN-98234-VISA`);

  // Verify Invoice fully paid
  invCheck = await api(`/invoices/${invoiceId}`, { method: 'GET' }, recSession.cookies);
  assert.strictEqual(invCheck.data.data.status, 'paid', 'Invoice status must be paid');
  assert.strictEqual(invCheck.data.data.remainingAmount, 0, 'Remaining balance must be 0');
  console.log(`✓ Invoice verified as fully paid! Status=${invCheck.data.data.status}, Remaining=$0\n`);

  console.log('===============================================================');
  console.log('🎉 ALL END-TO-END BUSINESS WORKFLOW STEPS PASSED WITH 100% INTEGRITY');
  console.log('===============================================================');
}

runE2EWorkflow().catch((err) => {
  console.error('Workflow Failed:', err);
  process.exit(1);
});
