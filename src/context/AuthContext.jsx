import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  seedDefaultUserIfEmpty,
  getUsersVault,
  saveUsersVault,
  findUserByHelpNumber,
  hashPassword,
  generateSalt,
  constantTimeEquals,
  evaluatePasswordStrength,
  generateCryptographicOTP,
  storeActiveOtp,
  getActiveOtp,
  decrementOtpAttempt,
  clearActiveOtp,
  checkAccountLockout,
  recordFailedAttempt,
  resetFailedAttempts,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  recordSecurityEvent,
  getAuditLogs,
  sanitizeInput,
  normalizeHelpNumber,
  isValidHelpNumber,
  isValidEmail
} from '../utils/security';
import { playAlertSentSound, playTactileClick } from '../utils/audio';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Modal controls
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'signup'
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  // Simulated SMS Toast for demo convenience
  const [simulatedOtpNotice, setSimulatedOtpNotice] = useState(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);

  // Initialize on mount
  useEffect(() => {
    async function init() {
      await seedDefaultUserIfEmpty();
      const session = getActiveSession();
      if (session && session.user) {
        setCurrentUser(session.user);
        setIsAuthenticated(true);
      }
      setAuditLogs(getAuditLogs());
      setAuthInitialized(true);
    }
    init();
  }, []);

  const refreshAuditLogs = useCallback(() => {
    setAuditLogs(getAuditLogs());
  }, []);

  // Open Auth Modal helper
  const openLogin = useCallback(() => {
    playTactileClick();
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
  }, []);

  const openSignUp = useCallback(() => {
    playTactileClick();
    setAuthModalMode('signup');
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  /**
   * SIGN UP with Basic Information & Password
   */
  const signUp = useCallback(async ({ name, helpNumber, email, bloodGroup, medicalConditions, emergencyContact, password }) => {
    const cleanName = sanitizeInput(name);
    const cleanNumber = normalizeHelpNumber(helpNumber);
    const cleanEmail = sanitizeInput(email);
    const cleanBlood = sanitizeInput(bloodGroup) || 'O+';
    const cleanMed = sanitizeInput(medicalConditions);
    const cleanContact = normalizeHelpNumber(emergencyContact);

    // Validation checks
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Full Name is required (minimum 2 characters).');
    }
    if (!isValidHelpNumber(cleanNumber)) {
      throw new Error('Valid 10-digit Help Number / Mobile Number is required.');
    }
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    // Password requirements check
    const pwdEval = evaluatePasswordStrength(password);
    if (!pwdEval.isValid) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, number, and special character.');
    }

    // Check duplicate help number
    const existing = findUserByHelpNumber(cleanNumber);
    if (existing) {
      throw new Error('An account with this Help Number already exists. Please log in.');
    }

    // Salt and hash password with WebCrypto SHA-256
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    const newUser = {
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: cleanName,
      helpNumber: cleanNumber,
      email: cleanEmail,
      bloodGroup: cleanBlood,
      medicalConditions: cleanMed,
      emergencyContact: cleanContact,
      salt,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    const vault = getUsersVault();
    vault.push(newUser);
    saveUsersVault(vault);

    // Automatically log in newly signed up user
    const session = setActiveSession(newUser);
    setCurrentUser(session.user);
    setIsAuthenticated(true);
    setIsAuthModalOpen(false);

    recordSecurityEvent('SIGNUP_SUCCESS', {
      userId: newUser.id,
      helpNumber: cleanNumber.slice(-4) ? '***' + cleanNumber.slice(-4) : '***'
    });
    refreshAuditLogs();

    return session.user;
  }, [refreshAuditLogs]);

  /**
   * LOGIN with Help Number + Password
   */
  const loginWithPassword = useCallback(async (helpNumber, password) => {
    const cleanNumber = normalizeHelpNumber(helpNumber);
    if (!isValidHelpNumber(cleanNumber)) {
      throw new Error('Please enter a valid 10-digit Help Number.');
    }
    if (!password) {
      throw new Error('Password is required.');
    }

    // Check brute force lockout
    const lockout = checkAccountLockout(cleanNumber);
    if (lockout.isLocked) {
      recordSecurityEvent('LOGIN_REJECTED_LOCKED', { helpNumber: '***' + cleanNumber.slice(-4) });
      refreshAuditLogs();
      throw new Error(`Account temporarily locked for security. Try again in ${lockout.remainingSeconds} seconds.`);
    }

    const user = findUserByHelpNumber(cleanNumber);
    if (!user) {
      // Record failed attempt to prevent timing enumeration
      recordFailedAttempt(cleanNumber);
      recordSecurityEvent('LOGIN_FAILED_USER_NOT_FOUND', { helpNumber: '***' + cleanNumber.slice(-4) });
      refreshAuditLogs();
      throw new Error('Invalid Help Number or password.');
    }

    // Hash input with user's stored salt and verify with constant-time equality
    const testHash = await hashPassword(password, user.salt);
    const isMatch = constantTimeEquals(testHash, user.passwordHash);

    if (!isMatch) {
      const attempt = recordFailedAttempt(cleanNumber);
      recordSecurityEvent('LOGIN_FAILED_BAD_PASSWORD', {
        helpNumber: '***' + cleanNumber.slice(-4),
        attemptsLeft: attempt.remainingAttempts
      });
      refreshAuditLogs();

      if (attempt.isLocked) {
        throw new Error('Too many failed attempts. Account locked for 60 seconds.');
      } else {
        throw new Error(`Invalid password. ${attempt.remainingAttempts} attempts remaining before temporary lockout.`);
      }
    }

    // Successful login: reset failed attempts
    resetFailedAttempts(cleanNumber);
    const session = setActiveSession(user);
    setCurrentUser(session.user);
    setIsAuthenticated(true);
    setIsAuthModalOpen(false);

    recordSecurityEvent('LOGIN_PASSWORD_SUCCESS', {
      userId: user.id,
      helpNumber: '***' + cleanNumber.slice(-4)
    });
    refreshAuditLogs();

    return session.user;
  }, [refreshAuditLogs]);

  /**
   * REQUEST OTP (Generates 6-digit CSPRNG OTP with 5-minute TTL)
   */
  const requestOtp = useCallback(async (helpNumber) => {
    const cleanNumber = normalizeHelpNumber(helpNumber);
    if (!isValidHelpNumber(cleanNumber)) {
      throw new Error('Please enter a valid 10-digit Help Number.');
    }

    const lockout = checkAccountLockout(cleanNumber);
    if (lockout.isLocked) {
      throw new Error(`Account temporarily locked. Try again in ${lockout.remainingSeconds} seconds.`);
    }

    // Generate cryptographic OTP
    const code = generateCryptographicOTP();
    const otpRecord = storeActiveOtp(cleanNumber, code);

    recordSecurityEvent('OTP_DISPATCHED', {
      helpNumber: '***' + cleanNumber.slice(-4),
      expiresInMinutes: 5
    });
    refreshAuditLogs();

    // Trigger audible notification & show simulated SMS notification banner
    playAlertSentSound();
    setSimulatedOtpNotice({
      phone: cleanNumber,
      code,
      expiresAt: otpRecord.expiresAt
    });

    return { success: true, code, expiresAt: otpRecord.expiresAt };
  }, [refreshAuditLogs]);

  /**
   * VERIFY OTP & Login
   */
  const verifyOtp = useCallback(async (helpNumber, enteredOtp) => {
    const cleanNumber = normalizeHelpNumber(helpNumber);
    const cleanCode = (enteredOtp || '').trim();

    if (!cleanCode || cleanCode.length !== 6) {
      throw new Error('Please enter all 6 digits of the OTP.');
    }

    const activeOtp = getActiveOtp(cleanNumber);
    if (!activeOtp) {
      throw new Error('OTP has expired or was not requested. Please request a new OTP.');
    }

    if (Date.now() > activeOtp.expiresAt) {
      clearActiveOtp(cleanNumber);
      throw new Error('OTP has expired. Please request a new code.');
    }

    const isMatch = constantTimeEquals(cleanCode, activeOtp.code);

    if (!isMatch) {
      const attemptsLeft = decrementOtpAttempt(cleanNumber);
      recordSecurityEvent('OTP_FAILED', {
        helpNumber: '***' + cleanNumber.slice(-4),
        attemptsLeft
      });
      refreshAuditLogs();

      if (attemptsLeft <= 0) {
        throw new Error('Too many invalid OTP attempts. This OTP has been invalidated. Please request a new one.');
      } else {
        throw new Error(`Invalid verification code. ${attemptsLeft} attempts remaining.`);
      }
    }

    // OTP Correct! Clear OTP and log in
    clearActiveOtp(cleanNumber);
    setSimulatedOtpNotice(null);

    let user = findUserByHelpNumber(cleanNumber);
    if (!user) {
      // If user doesn't exist yet, create a basic verified profile
      const defaultSalt = generateSalt();
      const defaultHash = await hashPassword('Raksha@' + cleanCode, defaultSalt);
      user = {
        id: 'user_otp_' + Date.now(),
        name: 'Citizen ' + cleanNumber.slice(-4),
        helpNumber: cleanNumber,
        email: '',
        bloodGroup: 'O+',
        medicalConditions: '',
        emergencyContact: '',
        salt: defaultSalt,
        passwordHash: defaultHash,
        createdAt: new Date().toISOString()
      };
      const vault = getUsersVault();
      vault.push(user);
      saveUsersVault(vault);
    }

    resetFailedAttempts(cleanNumber);
    const session = setActiveSession(user);
    setCurrentUser(session.user);
    setIsAuthenticated(true);
    setIsAuthModalOpen(false);

    recordSecurityEvent('LOGIN_OTP_SUCCESS', {
      userId: user.id,
      helpNumber: '***' + cleanNumber.slice(-4)
    });
    refreshAuditLogs();

    return session.user;
  }, [refreshAuditLogs]);

  /**
   * LOGOUT
   */
  const logout = useCallback(() => {
    playTactileClick();
    if (currentUser) {
      recordSecurityEvent('LOGOUT', {
        userId: currentUser.id,
        helpNumber: '***' + (currentUser.helpNumber || '').slice(-4)
      });
    }
    clearActiveSession();
    setCurrentUser(null);
    setIsAuthenticated(false);
    refreshAuditLogs();
  }, [currentUser, refreshAuditLogs]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        authInitialized,
        isAuthModalOpen,
        authModalMode,
        isSecurityModalOpen,
        setIsSecurityModalOpen,
        openLogin,
        openSignUp,
        closeAuthModal,
        setAuthModalMode,
        signUp,
        loginWithPassword,
        requestOtp,
        verifyOtp,
        logout,
        simulatedOtpNotice,
        dismissSimulatedOtpNotice: () => setSimulatedOtpNotice(null),
        auditLogs,
        refreshAuditLogs
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
