import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import { 
  CheckCircle, ArrowRight, Upload, Loader2, ScanFace, Eye, EyeOff, 
  ShieldCheck, RefreshCw, Clock, Info, Settings, LogOut, Download, 
  Users, Trash2, ShieldAlert, Activity, Mail, UserPlus, ListFilter,
  MessageSquare, FileText, BarChart3, Fingerprint, Lock, Shield, X, Maximize2,
  ChevronLeft, ChevronRight, Phone, AlertCircle, CheckSquare, Ticket, Image as ImageIcon, Bell, Edit, Send, Timer
} from 'lucide-react';

// === FIREBASE IMPORTS ===
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';

// =========================================================================
// FORCE MOBILE VIEWPORT
// =========================================================================
if (typeof document !== 'undefined') {
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = "viewport";
    document.getElementsByTagName('head')[0].appendChild(meta);
  }
  meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
}

// =========================================================================
// 1. NATIVE CAMERA COMPONENT
// =========================================================================
const NativeCamera = ({ videoRef }) => {
  useEffect(() => {
    let stream = null;
    const startCam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access denied:", err);
      }
    };
    startCam();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [videoRef]);

  return (
    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-90 transition-opacity" style={{ transform: 'scaleX(-1)' }} />
  );
};

const captureFrame = (videoRef) => {
  if (videoRef.current && videoRef.current.readyState === 4) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg');
  }
  return 'https://via.placeholder.com/150';
};

// =========================================================================
// 2. AI FACE RECOGNITION UTILS
// =========================================================================
const loadModels = async () => {
  try {
    const MODEL_URL = '/models'; 
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    return true;
  } catch (error) {
    console.error("Face AI Model Error:", error);
    return false;
  }
};

const getFaceDescriptor = async (videoRef) => {
  if (videoRef.current && videoRef.current.readyState === 4) {
    try {
      const detection = await faceapi.detectSingleFace(videoRef.current).withFaceLandmarks().withFaceDescriptor();
      if (detection) return Array.from(detection.descriptor); 
    } catch(err) { console.error("Detection Error:", err); }
  }
  return null;
};

const calculateDistance = (desc1, desc2) => {
  if(!desc1 || !desc2) return 1;
  let distance = 0;
  for (let i = 0; i < 128; i++) distance += Math.pow(desc1[i] - desc2[i], 2);
  return Math.sqrt(distance);
};

const hashPassword = async (password) => {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const generateSecureHash = (userId, candidateId) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let hash = 'ECI-';
  for (let i = 0; i < 48; i++) hash += chars.charAt(Math.floor(Math.random() * chars.length));
  return hash;
};

// =========================================================================
// 3. REUSABLE UI COMPONENTS
// =========================================================================
const EciLogoHeader = () => (
  <div className="flex flex-col items-center justify-center bg-white p-4 rounded-t-xl border-b-[4px] border-[#c0267a] shadow-sm w-full no-print">
    <div className="w-full text-center pb-2 mb-2 border-b border-slate-100">
        <p className="text-xs md:text-sm font-black text-[#000080] uppercase tracking-[0.2em]">General Assembly Election</p>
    </div>
    <div className="flex items-center justify-center gap-3 md:gap-4 w-full">
        <img src="/eci-logo.png" alt="ECI Logo" className="w-12 h-12 md:w-14 md:h-14 object-contain" onError={(e) => {e.target.src='https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Election_Commission_of_India_Logo.svg/1024px-Election_Commission_of_India_Logo.svg.png'}}/>
        <div className="text-left flex flex-col justify-center">
            <h1 className="text-[14px] md:text-[1.2rem] font-bold text-slate-800 leading-tight mb-0.5 tracking-wide">भारत निर्वाचन आयोग</h1>
            <h2 className="text-[10px] md:text-[0.9rem] font-black text-slate-900 leading-tight tracking-wide uppercase md:normal-case">Election Commission of India</h2>
        </div>
    </div>
  </div>
);

const EciLogoSmall = () => (
  <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-md border-b-2 border-[#c0267a] shadow-sm">
    <img src="/eci-logo.png" alt="ECI Logo" className="w-7 h-7 md:w-8 md:h-8 object-contain" onError={(e) => {e.target.src='https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Election_Commission_of_India_Logo.svg/1024px-Election_Commission_of_India_Logo.svg.png'}}/>
    <div className="text-left flex flex-col justify-center">
      <h2 className="text-[10px] md:text-[12px] font-black text-slate-900 leading-none tracking-wide">Election Commission of India</h2>
      <p className="text-[8px] md:text-[9px] font-bold text-[#000080] mt-0.5 uppercase tracking-widest">General Assembly Election</p>
    </div>
  </div>
);

const EciAdminSidebarLogo = () => (
  <div className="flex flex-col items-center justify-center text-center">
    <img src="/eci-logo.png" alt="ECI Logo" className="w-16 h-16 object-contain mb-3 drop-shadow-md" onError={(e) => {e.target.src='https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Election_Commission_of_India_Logo.svg/1024px-Election_Commission_of_India_Logo.svg.png'}}/>
    <h1 className="text-[17px] font-black text-[#000080] leading-tight tracking-wide">Election Commission</h1>
    <h2 className="text-[10px] font-bold text-slate-500 mt-1 leading-tight uppercase tracking-widest">Admin Portal</h2>
  </div>
);

const ToastManager = () => {
    const { toasts } = useVoting();
    if(toasts.length === 0) return null;
    return (
        <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none no-print">
            {toasts.map(t => (
                <div key={t.id} className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl animate-fade-in-up border backdrop-blur-md ${
                    t.type === 'error' ? 'bg-red-600/95 text-white border-red-500' :
                    t.type === 'info' ? 'bg-[#000080]/95 text-white border-blue-500' :
                    'bg-[#138808]/95 text-white border-green-500'
                }`}>
                    {t.type === 'error' ? <AlertCircle size={24}/> : t.type === 'info' ? <Info size={24}/> : <CheckCircle size={24}/>}
                    <p className="font-bold text-sm tracking-wide">{t.message}</p>
                </div>
            ))}
        </div>
    )
}

// =========================================================================
// 4. FIREBASE CONTEXT & STATE MANAGEMENT
// =========================================================================
const VotingContext = createContext();
const useVoting = () => useContext(VotingContext);

const VotingProvider = ({ children }) => {
  const [users, setUsers] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [config, setConfig] = useState({ electionStatus: 'upcoming', votes: {}, resultsPublished: false, electionStartTime: null, emailServiceEnabled: false });
  
  const [loggedInUserId, setLoggedInUserId] = useState(() => localStorage.getItem('voterSession') || null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [db, setDb] = useState(null);
  const [appId, setAppId] = useState('eci-smart-vote');

  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'success') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  useEffect(() => {
      try {
          const fbConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
              apiKey: "AIzaSyDhERHkRyTnZwuLwnVlS-tASEGF1cFvkjs",
              authDomain: "smartvote-5f6ce.firebaseapp.com",
              projectId: "smartvote-5f6ce",
              storageBucket: "smartvote-5f6ce.firebasestorage.app",
              messagingSenderId: "771468941468",
              appId: "1:771468941468:web:f1748c4c05b12ddc92f559",
              measurementId: "G-7EPGSBNQ2T"
          };
          const app = initializeApp(fbConfig);
          try { getAnalytics(app); } catch(e) {}
          const auth = getAuth(app);
          setDb(getFirestore(app));
          if(typeof __app_id !== 'undefined') setAppId(__app_id);

          const initAuth = async () => {
              try {
                  if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                      await signInWithCustomToken(auth, __initial_auth_token);
                  } else {
                      await signInAnonymously(auth);
                  }
                  setAuthInitialized(true);
              } catch (authErr) {
                  console.error("Auth Error:", authErr);
                  setAuthInitialized(true); 
              }
          };
          initAuth();
      } catch (err) { console.error("Firebase Init Error:", err); }
  }, []);

  useEffect(() => {
      if (!authInitialized || !db) return;
      const publicPath = `artifacts/${appId}/public/data`;

      const unsubUsers = onSnapshot(collection(db, publicPath, 'users'), (snap) => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      const unsubCandidates = onSnapshot(collection(db, publicPath, 'candidates'), (snap) => setCandidates(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      const unsubLogs = onSnapshot(collection(db, publicPath, 'logs'), (snap) => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))));
      const unsubTickets = onSnapshot(collection(db, publicPath, 'tickets'), (snap) => setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))));

      const unsubConfig = onSnapshot(doc(db, publicPath, 'config', 'main'), (docSnap) => {
          if (docSnap.exists()) setConfig(docSnap.data());
          else setDoc(doc(db, publicPath, 'config', 'main'), { electionStatus: 'upcoming', votes: {}, resultsPublished: false, electionStartTime: null, emailServiceEnabled: false });
      });

      return () => { unsubUsers(); unsubConfig(); unsubCandidates(); unsubLogs(); unsubTickets(); };
  }, [authInitialized, db, appId]);

  useEffect(() => {
      if(loggedInUserId) localStorage.setItem('voterSession', loggedInUserId);
      else localStorage.removeItem('voterSession');
  }, [loggedInUserId]);

  const logAction = async (action, details) => {
      if(!db) return;
      await addDoc(collection(db, `artifacts/${appId}/public/data`, 'logs'), { action, user: details, timestamp: new Date().toISOString() });
  };

  // Dynamic Email Function
  const sendEmail = async (to_email, subject, message) => {
      if (!config?.emailServiceEnabled) {
          console.log(`[EMAIL API OFF] Prevented sending email to: ${to_email} | Subject: ${subject}`);
          return true; // Pretend it succeeded so UI doesn't break
      }

      const SERVICE_ID = 'service_6p41jep'; 
      const TEMPLATE_ID = 'template_gtv5x88'; 
      const PUBLIC_KEY = '5BgUEGlUJN3pofcYM'; 

      try {
        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: SERVICE_ID,
            template_id: TEMPLATE_ID,
            user_id: PUBLIC_KEY,
            template_params: { to_email, subject, message }
          })
        });
        return res.ok;
      } catch (e) {
        console.error("EmailJS Error:", e);
        return false;
      }
  };

  const register = async (userData) => {
      if(!db) throw new Error("Database connection failed.");
      if (users.some(u => u.aadharNo === userData.aadharNo)) throw new Error("Aadhar Number is already registered.");
      if (users.some(u => u.email === userData.email)) throw new Error("Email address is already registered.");
      if (users.some(u => u.mobile === userData.mobile)) throw new Error("Mobile number is already registered.");

      const hashedPassword = await hashPassword(userData.password);
      const newUser = { ...userData, password: hashedPassword, status: 'pending', hasVoted: false, role: 'voter', createdAt: new Date().toISOString() };
      
      await addDoc(collection(db, `artifacts/${appId}/public/data`, 'users'), newUser);
      await logAction('NEW_REGISTRATION', `Aadhar ending in ${userData.aadharNo.slice(-4)}`);
      showToast("Registration Complete! Pending Admin KYC.", "success");
      return true;
  };

  const login = async (loginId, password) => {
      if (loginId === 'admin@eci.gov.in' && password === 'Admin@123') {
          setLoggedInUserId('admin');
          await logAction('ADMIN_LOGIN', 'System Admin logged in');
          showToast("Welcome Chief Electoral Officer", "info");
          return 'admin';
      }
      const hashedInputPassword = await hashPassword(password);
      const user = users.find(u => (u.aadharNo === loginId || u.email === loginId || u.mobile === loginId) && u.password === hashedInputPassword);
      
      if (user) {
          if(user.status === 'pending') throw new Error("Your KYC is pending review by the Electoral Authority.");
          if(user.status === 'rejected') throw new Error("Your KYC application was rejected. Please submit a Re-KYC request.");
          setLoggedInUserId(user.id);
          await logAction('USER_LOGIN', `Voter Logged in: ${user.aadharNo.slice(-4)}`);
          showToast(`Authentication successful, ${user.firstName}!`, "success");
          return 'voter';
      }
      throw new Error("Invalid Credentials provided.");
  };

  const loginByFace = async (userId) => {
      const user = users.find(u => u.id === userId);
      if (user) {
          if(user.status === 'pending') throw new Error("Your KYC is pending review by the Electoral Authority.");
          if(user.status === 'rejected') throw new Error("Your KYC application was rejected. Please submit a Re-KYC request.");
          setLoggedInUserId(userId);
          await logAction('FACE_LOGIN', `Verified via Biometrics`);
          showToast(`Biometric Authentication Successful!`, "success");
          return true;
      }
      return false;
  };

  const logout = () => {
      if(loggedInUserId === 'admin') logAction('ADMIN_LOGOUT', 'System Admin logged out');
      else logAction('USER_LOGOUT', 'Voter logged out');
      setLoggedInUserId(null);
      showToast("Logged out securely.", "info");
  };

  const resetUserPassword = async (email, newPassword) => {
      if(!db) return false;
      const user = users.find(u => u.email === email);
      if(!user) throw new Error("No user found with this email address.");
      
      const hashedPassword = await hashPassword(newPassword);
      await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'users', user.id), { password: hashedPassword });
      await logAction('PASSWORD_RESET', `Password reset for email: ${email}`);
      showToast("Password has been reset successfully.", "success");
      return true;
  };

  const requestKycUpdate = async (userId, newKycData) => {
      if(!db) return;
      const user = users.find(u => u.id === userId);
      
      const backup = {
          aadharPhoto: user.aadharPhoto,
          facePhoto: user.facePhoto,
          faceDescriptor: user.faceDescriptor,
          status: user.status
      };

      await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'users', userId), {
          aadharPhoto: newKycData.aadharPhoto,
          facePhoto: newKycData.facePhoto,
          faceDescriptor: newKycData.faceDescriptor,
          backupKyc: backup,
          status: 'pending'
      });
      await logAction('KYC_UPDATE_REQUESTED', `User ID: ${userId}`);
      showToast("Re-KYC Request Submitted. Account temporarily suspended.", "info");
  };

  const castVote = async (candidateId) => {
      if (!loggedInUserId || !db) return;
      const newVotes = { ...config.votes, [candidateId]: (config.votes[candidateId] || 0) + 1 };
      const voteHash = generateSecureHash(loggedInUserId, candidateId);
      
      await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'config', 'main'), { votes: newVotes });
      await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'users', loggedInUserId), { hasVoted: true, voteHash });
      await logAction('VOTE_CAST', `Hash: ${voteHash.substring(0,16)}...`);
      showToast("Vote securely cast and encrypted on the ledger.", "success");
  };

  const updateConfig = async (updates) => {
      if(!db) return;
      await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'config', 'main'), updates);
      await logAction('SYSTEM_UPDATE', `System configuration modified`);
      showToast("System Configuration Updated", "info");

      // Mass Email Triggers
      if (updates.electionStatus === 'active') {
          const approvedUsersList = users.filter(u => u.status === 'approved');
          approvedUsersList.forEach(u => {
              sendEmail(u.email, "Election Started - ECI Portal", `Dear ${u.firstName},\n\nThe voting lines are now open. Please login to the E-Voting portal to cast your secure vote.\n\nRegards,\nElection Commission of India`);
          });
          if(config?.emailServiceEnabled) showToast(`Emails dispatched to ${approvedUsersList.length} voters.`, "success");
      }
      if (updates.resultsPublished === true) {
          const approvedUsersList = users.filter(u => u.status === 'approved');
          approvedUsersList.forEach(u => {
              sendEmail(u.email, "Election Results Declared - ECI", `Dear ${u.firstName},\n\nThe official election results have been declared. Please login to the portal to view the final vote analytics.\n\nRegards,\nElection Commission of India`);
          });
          if(config?.emailServiceEnabled) showToast(`Result notifications sent to ${approvedUsersList.length} voters.`, "success");
      }
  };

  const approveUser = async (userId) => {
      if(!db) return;
      const user = users.find(u => u.id === userId);
      await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'users', userId), { 
          status: 'approved',
          backupKyc: null
      });
      await logAction('KYC_APPROVED', `User ID: ${userId}`);
      if(user) sendEmail(user.email, "KYC Approved - ECI Portal", "Congratulations! Your KYC document and biometric verification is successful. You can now participate in elections.");
      showToast(`User KYC Approved`, 'success');
  };

  const rejectUser = async (userId) => {
      if(!db) return;
      const user = users.find(u => u.id === userId);
      
      if (user && user.backupKyc) {
          await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'users', userId), { 
              aadharPhoto: user.backupKyc.aadharPhoto,
              facePhoto: user.backupKyc.facePhoto,
              faceDescriptor: user.backupKyc.faceDescriptor,
              status: user.backupKyc.status,
              backupKyc: null
          });
          await logAction('KYC_UPDATE_REJECTED', `Reverted to old KYC for User: ${userId}`);
          sendEmail(user.email, "Re-KYC Rejected - ECI Portal", "Your recent Re-KYC request was rejected due to unclear documentation. Your previous active profile has been restored.");
          showToast(`Update Rejected. Old Profile Restored.`, 'info');
      } else {
          await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'users', userId), { status: 'rejected' });
          await logAction('KYC_REJECTED', `User ID: ${userId}`);
          if(user) sendEmail(user.email, "KYC Rejected - ECI Portal", "Your KYC verification failed. Please login and submit a Re-KYC request with clear documents.");
          showToast(`User KYC Rejected`, 'error');
      }
  };

  const deleteUser = async (userId) => {
      if(!db) return;
      await deleteDoc(doc(db, `artifacts/${appId}/public/data`, 'users', userId));
      await logAction('USER_DELETED', `Admin deleted User ID: ${userId}`);
      showToast("User Permanently Deleted", "info");
  };

  const addCandidate = async (candidateData) => {
      if(!db) return;
      await addDoc(collection(db, `artifacts/${appId}/public/data`, 'candidates'), candidateData);
      await logAction('CANDIDATE_ADDED', `Party: ${candidateData.party}`);
      showToast("New Candidate Profile Added", "success");
  };

  const updateCandidate = async (candidateId, candidateData) => {
      if(!db) return;
      await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'candidates', candidateId), candidateData);
      await logAction('CANDIDATE_UPDATED', `Party: ${candidateData.party}`);
      showToast("Candidate Profile Updated", "success");
  };

  const deleteCandidate = async (candidateId) => {
      if(!db) return;
      await deleteDoc(doc(db, `artifacts/${appId}/public/data`, 'candidates', candidateId));
      await logAction('CANDIDATE_DELETED', `Candidate removed.`);
      showToast("Candidate Removed", "info");
  };

  const updateProfile = async (userId, data) => {
      if(!db) return;
      await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'users', userId), data);
      await logAction('PROFILE_UPDATE', `User ID: ${userId}`);
      showToast("Profile Information Updated", "success");
  };

  const submitTicket = async (userId, userName, userMobile, userEmail, message) => {
      if(!db) return;
      await addDoc(collection(db, `artifacts/${appId}/public/data`, 'tickets'), {
          userId, userName, userMobile, userEmail, message, status: 'open', adminReply: '', createdAt: new Date().toISOString()
      });
      await logAction('TICKET_CREATED', `Support requested by: ${userName}`);
      showToast("Support ticket raised. Admin will review shortly.", "info");
  };

  const resolveTicket = async (ticket, replyMessage) => {
      if(!db) return;
      await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'tickets', ticket.id), { 
          status: 'resolved',
          adminReply: replyMessage || "Resolved by Support Team"
      });
      await logAction('TICKET_RESOLVED', `Admin resolved ticket: ${ticket.id}`);
      
      const emailMsg = `Dear ${ticket.userName},\n\nYour support ticket regarding "${ticket.message}" has been successfully resolved.\n\nAdmin Reply: "${replyMessage || 'Resolved by Support Team'}"\n\nRegards,\nECI IT Cell`;
      await sendEmail(ticket.userEmail, "Support Ticket Resolved - ECI Portal", emailMsg);
      showToast("Ticket Resolved & Response Emailed", "success");
  };

  const dismissTicket = async (ticketId) => {
      if(!db) return;
      await deleteDoc(doc(db, `artifacts/${appId}/public/data`, 'tickets', ticketId));
      await logAction('TICKET_DISMISSED', `User dismissed ticket: ${ticketId}`);
      showToast("Ticket removed from dashboard", "info");
  };

  const resetElection = async () => {
      if(!db) return;
      try {
          await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'config', 'main'), { electionStatus: 'upcoming', votes: {}, resultsPublished: false, electionStartTime: null });
          for (let user of users) {
              if (user.hasVoted) await updateDoc(doc(db, `artifacts/${appId}/public/data`, 'users', user.id), { hasVoted: false, voteHash: null });
          }
          await logAction('ELECTION_RESET', `Admin initialized new election cycle.`);
          showToast("System Reset Complete. All ledgers cleared.", "error");
          return true;
      } catch (err) { console.error("Reset failed", err); return false; }
  };

  const clearLogs = async () => {
      if(!db) return;
      for (let log of logs) {
          await deleteDoc(doc(db, `artifacts/${appId}/public/data`, 'logs', log.id));
      }
      showToast("Audit Trail Cleared", "info");
  };

  let currentUser = null;
  if (loggedInUserId === 'admin') currentUser = { id: 'admin', role: 'admin', firstName: 'Chief Electoral', lastName: 'Officer', email: 'admin@eci.gov.in' };
  else if (loggedInUserId) currentUser = users.find(u => u.id === loggedInUserId) || null;

  return (
      <VotingContext.Provider value={{
          users, currentUser, candidates, logs, tickets, config, loggedInUserId, toasts, showToast, sendEmail,
          register, login, loginByFace, logout, castVote, updateConfig, resetUserPassword, requestKycUpdate,
          approveUser, rejectUser, deleteUser, addCandidate, updateCandidate, deleteCandidate, updateProfile, 
          resetElection, clearLogs, submitTicket, resolveTicket, dismissTicket, authInitialized
      }}>
          {children}
      </VotingContext.Provider>
  )
};

// =========================================================================
// 5. LOGIN PAGE
// =========================================================================
const LoginPage = () => {
  const navigate = useNavigate();
  const { login, loginByFace, users, resetUserPassword, showToast, sendEmail } = useVoting(); 
  const videoRef = useRef(null);
  
  const [loginMethod, setLoginMethod] = useState('password'); 
  const [loginId, setLoginId] = useState(''); 
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("Initializing AI Models...");
  const [error, setError] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const [showForgotPass, setShowForgotPass] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');

  useEffect(() => {
    loadModels().then((success) => {
        setModelsLoaded(success);
        if(success) setScanStatus("AI Ready. Please frame your face.");
        else setScanStatus("AI Loading Failed. Please refresh.");
    });
  }, []);

  const handlePasswordLogin = async (e) => {
    e.preventDefault(); setError('');
    try {
        const role = await login(loginId.trim(), password);
        if(role === 'admin') navigate('/admin');
        else navigate('/dashboard');
    } catch(err) { 
        setError(err.message); 
        showToast(err.message, "error");
    }
  };

  const handleFaceLogin = async () => {
    if (!modelsLoaded) return setError("Please wait, AI engines are initializing...");
    if (!loginId.trim()) return setError("Please enter your Aadhar or Mobile number first.");
    
    setError(''); setIsScanning(true); setScanStatus("Analyzing Biometrics...");
    
    try {
      const liveDescriptor = await getFaceDescriptor(videoRef); 
      if (!liveDescriptor) {
         setScanStatus("Verification Failed!"); setError("Face not detected. Ensure adequate lighting.");
         showToast("Face not detected. Adjust lighting conditions.", "error");
         setIsScanning(false); return;
      }
      
      const targetUser = users.find(u => u.aadharNo === loginId || u.mobile === loginId || u.email === loginId);
      
      if (targetUser && targetUser.faceDescriptor) {
        const distance = calculateDistance(liveDescriptor, targetUser.faceDescriptor);
        if (distance < 0.45) { 
          setScanStatus("Match Found! Authenticating...");
          try {
              await loginByFace(targetUser.id);
              setTimeout(() => navigate('/dashboard'), 1500);
          } catch(err) { setScanStatus("Access Denied"); setError(err.message); showToast(err.message, "error"); }
        } else {
          setScanStatus("Biometric Mismatch!"); setError("Facial mismatch detected. Please retry.");
          showToast("Biometric Mismatch! Access Denied.", "error");
        }
      } else {
        setScanStatus("User Not Found"); setError("No biometric profile found for the provided ID.");
        showToast("No biometric profile found.", "error");
      }
    } catch (err) { console.error(err); setError("System processing error occurred."); }
    setIsScanning(false);
  };

  const handleSendOTP = async (e) => {
      e.preventDefault();
      const userExists = users.find(u => u.email === forgotEmail);
      if (!userExists) {
          showToast("This email address is not registered.", "error");
          return;
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      setOtpSent(true);
      showToast("Generating secure OTP...", "info");

      await sendEmail(
          forgotEmail, 
          "ECI Portal - Password Reset OTP", 
          `Hello ${userExists.firstName},\n\nYour secure OTP for E-Voting Portal password reset is: ${otp}.\n\nPlease do not share this OTP with anyone.\n\nRegards,\nElection Commission`
      );

      showToast(`OTP dispatch sequence initiated for ${forgotEmail}`, "success");
  };

  const handleResetPassword = async (e) => {
      e.preventDefault();
      if(otpInput === generatedOtp) { 
          try {
              await resetUserPassword(forgotEmail, newPassword);
              setResetSuccess(true);
              setTimeout(() => {
                  setShowForgotPass(false);
                  setOtpSent(false);
                  setResetSuccess(false);
                  setForgotEmail('');
                  setOtpInput('');
                  setNewPassword('');
              }, 3000);
          } catch (err) {
              showToast(err.message, "error");
          }
      } else {
          showToast("Invalid OTP provided!", "error");
      }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden transition-all duration-500">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#FF9933] opacity-10 rounded-full blur-3xl animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-[#138808] opacity-10 rounded-full blur-3xl animate-pulse-slow"></div>

      {showForgotPass && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border-t-4 border-[#000080] animate-fade-in-up">
                <h3 className="text-xl font-bold text-[#000080] mb-2 flex items-center gap-2"><ShieldCheck size={20}/> Secure Password Reset</h3>
                
                {resetSuccess ? (
                    <div className="text-center py-6 animate-fade-in">
                        <CheckCircle size={48} className="text-[#138808] mx-auto mb-4"/>
                        <p className="text-lg font-bold text-slate-800">Password Reset Successful!</p>
                        <p className="text-sm text-slate-500">You may now proceed to login.</p>
                    </div>
                ) : !otpSent ? (
                    <form onSubmit={handleSendOTP} className="space-y-4 animate-fade-in">
                        <p className="text-sm text-slate-600 mb-4">Please provide your registered email address to receive an authorization OTP.</p>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Registered Email ID</label>
                            <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#000080] outline-none" placeholder="voter@india.gov.in" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setShowForgotPass(false)} className="flex-1 bg-slate-200 text-slate-700 py-2.5 rounded-lg font-bold hover:bg-slate-300 transition-colors">Cancel</button>
                            <button type="submit" className="flex-1 bg-[#000080] text-white py-2.5 rounded-lg font-bold hover:bg-blue-900 transition-colors flex justify-center items-center gap-2"><Mail size={16}/> Dispatch OTP</button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4 animate-fade-in">
                        <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm border border-green-200 mb-4">
                            OTP dispatched to <b>{forgotEmail}</b>. Please verify your inbox.
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Enter 6-Digit OTP</label>
                            <input type="text" required maxLength="6" value={otpInput} onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#138808] outline-none text-center tracking-[0.5em] font-mono font-bold text-lg" placeholder="------" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">New Secure Password</label>
                            <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#000080] outline-none" placeholder="New Strong Password" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setOtpSent(false)} className="flex-1 bg-slate-200 text-slate-700 py-2.5 rounded-lg font-bold hover:bg-slate-300 transition-colors">Go Back</button>
                            <button type="submit" disabled={otpInput.length !== 6 || !newPassword} className="flex-1 bg-[#138808] text-white py-2.5 rounded-lg font-bold hover:bg-green-700 transition-colors disabled:bg-slate-300">Verify & Update</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
      )}

      <div className="w-full max-w-md text-center mb-6 z-10 animate-fade-in-up">
        <EciLogoHeader />
      </div>

      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 z-10 animate-fade-in-up delay-100">
        <div className="p-8">
          <h2 className="text-xl font-black text-center text-[#000080] mb-6 border-b pb-3 flex items-center justify-center gap-2">
            <ShieldCheck size={24} className="text-[#138808]"/> PORTAL LOGIN
          </h2>
          
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-5 font-bold text-center border border-red-200 shadow-sm flex items-center justify-center gap-2 animate-fade-in"><ShieldAlert size={16}/> {error}</div>}

          <div className="flex bg-slate-100 p-1 rounded-xl mb-6 shadow-inner relative">
            <button onClick={() => {setLoginMethod('password'); setIsScanning(false);}} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 z-10 ${loginMethod === 'password' ? 'bg-white shadow-md text-[#000080]' : 'text-slate-500 hover:text-slate-700'}`}>Credential Login</button>
            <button onClick={() => setLoginMethod('face')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-300 z-10 ${loginMethod === 'face' ? 'bg-white shadow-md text-[#000080]' : 'text-slate-500 hover:text-slate-700'}`}>Biometric Login</button>
          </div>

          <form onSubmit={handlePasswordLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase tracking-wide">Aadhar / Mobile / Email <span className="text-red-500">*</span></label>
              <div className="relative">
                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Fingerprint size={18} className="text-slate-400"/></div>
                 <input type="text" required value={loginId} onChange={e => setLoginId(e.target.value)} className="w-full pl-10 p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#000080] outline-none transition-all font-medium" placeholder="Registered Identification" />
              </div>
            </div>

            {loginMethod === 'password' ? (
              <div className="animate-fade-in">
                <label className="block text-xs font-black text-slate-500 mb-1.5 uppercase tracking-wide">Secure Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock size={18} className="text-slate-400"/></div>
                  <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-10 p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#000080] outline-none transition-all font-medium" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-slate-400 hover:text-[#000080] transition-colors">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
                </div>
                <div className="text-right mt-2">
                    <button type="button" onClick={() => setShowForgotPass(true)} className="text-xs font-bold text-[#000080] hover:text-[#FF9933] transition-colors">Forgot Password?</button>
                </div>
                <button type="submit" className="w-full mt-4 bg-gradient-to-r from-[#000080] to-blue-900 text-white p-3.5 rounded-xl font-black hover:shadow-lg transform hover:-translate-y-0.5 transition-all tracking-widest uppercase">Authenticate</button>
              </div>
            ) : (
              <div className="animate-fade-in space-y-4 pt-2">
                <div className="bg-slate-900 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden h-64 border-4 border-slate-800 shadow-inner group">
                  {!modelsLoaded && <div className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center text-white font-bold gap-2"><Loader2 className="animate-spin" size={24}/> AI Initializing...</div>}
                  <NativeCamera videoRef={videoRef} />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                      <div className={`w-40 h-56 border-2 border-dashed rounded-[50px] transition-colors duration-300 ${isScanning ? 'border-[#138808]' : 'border-white/60'}`}></div>
                  </div>
                  {isScanning && <div className="absolute top-0 left-0 h-full w-full pointer-events-none overflow-hidden"><div className="w-full h-1.5 bg-[#138808] shadow-[0_0_15px_#138808] animate-[scan_2s_ease-in-out_infinite]"></div></div>}
                </div>
                <p className={`text-center text-xs font-black uppercase py-2 rounded-lg tracking-wide ${scanStatus.includes("Failed") || scanStatus.includes("Mismatch") ? 'text-red-600 bg-red-50 border border-red-100' : scanStatus.includes("Match Found") ? 'text-[#138808] bg-green-50 border border-green-100' : 'text-[#000080] bg-blue-50 border border-blue-100'}`}>{scanStatus}</p>
                <button type="button" onClick={handleFaceLogin} disabled={isScanning || !modelsLoaded || !loginId} className="w-full bg-gradient-to-r from-[#138808] to-green-700 text-white p-3.5 rounded-xl font-black shadow-lg flex justify-center items-center gap-2 disabled:opacity-50 hover:shadow-xl transform hover:-translate-y-0.5 transition-all uppercase tracking-widest">
                  {isScanning ? <Loader2 className="animate-spin" size={18}/> : <ScanFace size={20}/>} Verify Biometrics
                </button>
              </div>
            )}
          </form>
        </div>
        <div className="bg-slate-50 p-5 text-center border-t border-slate-200">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">New Electoral Registration?</p>
          <button onClick={() => navigate('/register')} className="text-[#FF9933] text-sm font-black hover:text-orange-600 transition-colors flex items-center justify-center gap-1 mx-auto">Apply for e-EPIC <ArrowRight size={16}/></button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 6. REGISTRATION PAGE
// =========================================================================
const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, users, showToast, sendEmail } = useVoting(); 
  const videoRef = useRef(null);
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', mobile: '', email: '', dob: '', password: '', confirmPassword: '', aadharNo: '', aadharPhoto: null, facePhoto: null, faceDescriptor: null });
  const [modelsLoaded, setModelsLoaded] = useState(false); 
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("Initializing Engine...");
  const [progress, setProgress] = useState(0);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateError, setDuplicateError] = useState(false);
  const scanIntervalRef = useRef(null);

  const [showPass, setShowPass] = useState(false);
  const [showConfPass, setShowConfPass] = useState(false);

  useEffect(() => {
    loadModels().then(success => setModelsLoaded(success));
    return () => { if(scanIntervalRef.current) clearInterval(scanIntervalRef.current); }
  }, []);

  const handleTextChange = (e) => {
    const val = e.target.value.replace(/[^A-Za-z\s]/g, '');
    setFormData({ ...formData, [e.target.name]: val });
  };
  
  const handleMobileChange = (e) => setFormData({ ...formData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) });
  const handleAadharChange = (e) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.length > 12) val = val.slice(0, 12);
      setFormData({ ...formData, aadharNo: val });
  };

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  const isPasswordValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(formData.password);

  const calculateAge = (dobString) => {
      if(!dobString) return 0;
      const today = new Date();
      const birthDate = new Date(dobString);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
      }
      return age;
  };
  const age = calculateAge(formData.dob);
  const isAgeValid = formData.dob && age >= 18;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { 
      if (file.size > 1048576) {
          showToast("Document size must not exceed 1MB", "error");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
          setFormData({ ...formData, aadharPhoto: reader.result });
          showToast("Document Uploaded Successfully", "success");
      };
      reader.readAsDataURL(file);
    }
  };

  const startScanning = async () => {
    if (!modelsLoaded) return alert("Please wait for system initialization.");
    setIsScanning(true); setProgress(0); setScanStatus("Hold posture steady...");
    let scans = 0; const requiredScans = 10; let totalDescriptor = new Float32Array(128).fill(0);
    
    scanIntervalRef.current = setInterval(async () => {
      if (scans >= requiredScans) {
        clearInterval(scanIntervalRef.current);
        const finalDescriptor = Array.from(totalDescriptor).map(val => val / requiredScans);
        setFormData(prev => ({ ...prev, faceDescriptor: finalDescriptor, facePhoto: captureFrame(videoRef) }));
        setIsScanning(false); setScanStatus("Profile Captured Successfully!");
        showToast("Biometric Profile Generated", "success");
        return;
      }
      try {
        const descriptor = await getFaceDescriptor(videoRef);
        if (descriptor) {
          for (let i = 0; i < 128; i++) totalDescriptor[i] += descriptor[i];
          scans++; setProgress(Math.round((scans / requiredScans) * 100)); setScanStatus(`Processing... ${Math.round((scans / requiredScans) * 100)}%`);
        } else { setScanStatus("Facial features obscured. Adjust environment."); }
      } catch (err) { clearInterval(scanIntervalRef.current); setIsScanning(false); setScanStatus("Device Error Encountered."); }
    }, 300);
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault(); if (isSubmitting) return; 
    setIsSubmitting(true);
    const cleanedFormData = { ...formData, email: formData.email.trim().toLowerCase() };

    if (users && cleanedFormData.faceDescriptor) {
        const isDuplicateFace = users.some(user => {
            if (!user.faceDescriptor) return false;
            return calculateDistance(user.faceDescriptor, cleanedFormData.faceDescriptor) < 0.38; 
        });
        if (isDuplicateFace) {
            setDuplicateError(true);
            setIsSubmitting(false);
            return; 
        }
    }

    try {
      const success = await register(cleanedFormData);
      if (success) {
          sendEmail(
            cleanedFormData.email, 
            "Registration Successful - ECI Portal", 
            `Dear ${cleanedFormData.firstName},\n\nYour registration for the E-Voting portal is successful. Your application is pending verification by the Electoral Authority. You will receive an update shortly.\n\nRegards,\nElection Commission of India`
          );
          navigate('/login');
      }
    } catch (err) { showToast(err.message, "error"); setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans animate-fade-in relative">
      
      {duplicateError && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm p-8 flex flex-col items-center text-center shadow-2xl border-t-8 border-red-600 animate-fade-in-up">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
              <ShieldAlert size={32}/>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-1 uppercase">Security Intervention</h3>
            <p className="text-red-600 font-bold text-xs mb-4 uppercase tracking-widest border-b pb-2">Profile Duplication Detected</p>
            <p className="text-slate-600 mb-6 text-sm font-medium">This biometric signature is currently linked to an existing electoral ID. Fraudulent multi-registration is strictly prohibited.</p>
            <button onClick={() => setDuplicateError(false)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold uppercase tracking-wide hover:bg-slate-800 transition-colors">Acknowledge</button>
          </div>
        </div>
      )}

      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <EciLogoHeader />
        <div className="bg-[#000080] p-4 text-white text-center border-b-4 border-[#FF9933]">
          <h2 className="text-xl font-black tracking-widest mb-1 uppercase">Electoral Registration</h2>
          <div className="flex justify-center items-center gap-3 mt-3">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-colors ${step >= num ? 'bg-[#138808] text-white shadow-[0_0_10px_rgba(19,136,8,0.5)]' : 'bg-[#000050] text-blue-300'}`}>{step > num ? <CheckCircle size={16}/> : num}</div>
                {num < 3 && <div className={`w-8 h-1 rounded ${step > num ? 'bg-[#138808]' : 'bg-[#000050]'}`}></div>}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-8">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Given Name</label>
                  <input name="firstName" required value={formData.firstName} onChange={handleTextChange} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#000080] outline-none" placeholder="First Name"/>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Surname</label>
                  <input name="lastName" required value={formData.lastName} onChange={handleTextChange} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#000080] outline-none" placeholder="Last Name"/>
                </div>
              </div>
              
              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Date of Birth</label>
                 <input name="dob" type="date" required value={formData.dob} max={new Date().toISOString().split("T")[0]} onChange={e => setFormData({...formData, dob: e.target.value})} className={`w-full p-3 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-[#000080] outline-none ${formData.dob && age < 18 ? 'border-red-500 bg-red-50' : 'border-slate-300'}`} />
                 {formData.dob && age < 18 && <p className="text-[10px] font-bold text-red-600 mt-1 uppercase tracking-wider">Minimum legal age requirement is 18 years.</p>}
              </div>

              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Mobile Identifier</label>
                 <input name="mobile" type="tel" required value={formData.mobile} onChange={handleMobileChange} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#000080] outline-none" placeholder="10-Digit Mobile"/>
              </div>
              <div>
                 <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Electronic Mail Address</label>
                 <input name="email" type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={`w-full p-3 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-[#000080] outline-none ${formData.email && !isEmailValid ? 'border-red-500 bg-red-50' : 'border-slate-300'}`} placeholder="Official Email"/>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Authentication Key</label>
                  <input type={showPass ? "text" : "password"} required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={`w-full p-3 pr-10 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-[#000080] outline-none text-sm ${formData.password && !isPasswordValid ? 'border-red-500 bg-red-50' : 'border-slate-300'}`} placeholder="Password"/>
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-8 text-slate-400 hover:text-[#000080]"><Eye size={18}/></button>
                </div>
                <div className="flex-1 relative">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Verify Key</label>
                  <input type={showConfPass ? "text" : "password"} required value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className={`w-full p-3 pr-10 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-[#000080] outline-none text-sm ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500 bg-red-50' : 'border-slate-300'}`} placeholder="Confirm"/>
                  <button type="button" onClick={() => setShowConfPass(!showConfPass)} className="absolute right-3 top-8 text-slate-400 hover:text-[#000080]"><Eye size={18}/></button>
                </div>
              </div>
              {formData.password && !isPasswordValid && (
                  <p className="text-[10px] text-red-600 font-bold bg-red-50 p-2 rounded border border-red-200">
                      Must contain 8+ characters: 1 Uppercase, 1 Lowercase, 1 Numeric, and 1 Special Symbol.
                  </p>
              )}
              
              <button onClick={() => setStep(2)} disabled={!formData.firstName || formData.mobile.length !== 10 || !isEmailValid || !isPasswordValid || formData.password !== formData.confirmPassword || !isAgeValid} className="w-full mt-4 bg-[#000080] text-white p-3.5 rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-wider">Proceed to KYC <ArrowRight size={18}/></button>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in-up">
              <div><label className="block text-xs font-black text-slate-500 mb-1.5 uppercase">12-Digit UIDAI (Aadhar)</label><input name="aadharNo" type="text" required value={formData.aadharNo} onChange={handleAadharChange} className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-center tracking-[0.2em] font-mono text-xl font-bold focus:ring-2 focus:ring-[#000080] outline-none" placeholder="XXXX XXXX XXXX"/></div>
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center relative bg-white">
                <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"/>
                {formData.aadharPhoto ? <img src={formData.aadharPhoto} className="h-40 mx-auto object-contain rounded-lg" alt="Preview"/> : <div><Upload size={40} className="mx-auto mb-2 text-[#000080] opacity-80"/><p className="font-black text-slate-700">Attach Document (Max 1MB)</p><p className="text-xs text-slate-500 font-bold mt-1">Legible frontal scan required</p></div>}
              </div>
              <div className="flex gap-4"><button onClick={() => setStep(1)} className="flex-1 bg-slate-200 p-3.5 rounded-xl font-black uppercase tracking-wider">Return</button><button onClick={() => setStep(3)} disabled={formData.aadharNo.length !== 12 || !formData.aadharPhoto} className="flex-1 bg-[#000080] text-white p-3.5 rounded-xl font-black disabled:opacity-50 uppercase tracking-wider">Proceed</button></div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="bg-slate-900 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden h-64 border-4 border-[#138808] shadow-inner">
                {formData.facePhoto ? (
                  <div className="text-center w-full h-full relative"><img src={formData.facePhoto} className="w-full h-full object-cover opacity-90" /><div className="absolute inset-0 bg-gradient-to-t from-[#138808]/90 via-transparent flex items-end justify-center pb-6"><p className="text-white font-black flex gap-2"><CheckCircle/> BIOMETRIC SECURED</p></div></div>
                ) : (
                  <>
                    {!modelsLoaded && <div className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center text-white font-bold gap-2"><Loader2 className="animate-spin" size={24}/> Engine Booting...</div>}
                    <NativeCamera videoRef={videoRef} />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-40 h-56 border-2 border-dashed border-white rounded-[50px] opacity-60"></div></div>
                    {isScanning && <div className="absolute top-0 left-0 h-1.5 bg-[#138808] w-full shadow-[0_0_15px_#138808] animate-[scan_2s_ease-in-out_infinite]"></div>}
                    {!isScanning && <button onClick={startScanning} disabled={!modelsLoaded} className="absolute bottom-6 bg-[#000080] text-white px-6 py-3 rounded-full font-black flex items-center gap-2 border-2 border-white/20 uppercase tracking-wider"><ScanFace size={20}/> Initiate Scan</button>}
                  </>
                )}
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${progress === 100 ? 'bg-[#138808]' : 'bg-[#FF9933] animate-pulse'}`}></div><p className="text-sm font-black text-slate-700 uppercase">{scanStatus}</p></div>
                {formData.facePhoto && <button onClick={()=>{setFormData({...formData, faceDescriptor:null, facePhoto:null}); setProgress(0);}} className="text-xs bg-white border px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"><RefreshCw size={14}/> Retry</button>}
              </div>
              <div className="flex gap-4"><button onClick={() => setStep(2)} className="flex-1 bg-slate-200 p-3.5 rounded-xl font-black uppercase">Return</button><button onClick={handleFinalSubmit} disabled={!formData.facePhoto || isSubmitting} className="flex-1 bg-[#138808] text-white p-3.5 rounded-xl font-black disabled:opacity-50 flex justify-center items-center gap-2 uppercase">{isSubmitting ? <Loader2 className="animate-spin"/> : <ShieldCheck/>} Finalize</button></div>
            </div>
          )}
        </div>
        <div className="bg-slate-50 p-4 text-center border-t border-slate-200"><button onClick={() => navigate('/login')} className="text-[#000080] text-sm font-black uppercase">Existing Elector? Login</button></div>
      </div>
    </div>
  );
};

// =========================================================================
// 7. USER DASHBOARD
// =========================================================================
const UserDashboard = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const kycVideoRef = useRef(null); 
  
  const { currentUser, users, candidates, castVote, logout, updateProfile, submitTicket, config, loggedInUserId, tickets, dismissTicket, showToast, requestKycUpdate, sendEmail } = useVoting();
  
  const [activeTab, setActiveTab] = useState('vote');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [status, setStatus] = useState('idle');
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const [mobile, setMobile] = useState(currentUser?.mobile || '');
  const [passEmailSent, setPassEmailSent] = useState(false);
  
  const [supportMessage, setSupportMessage] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  // Pre-poll Timer State
  const [timeLeft, setTimeLeft] = useState('');

  // Re-KYC States
  const [kycModalOpen, setKycModalOpen] = useState(false);
  const [kycStep, setKycStep] = useState(1);
  const [kycData, setKycData] = useState({ aadharPhoto: null, facePhoto: null, faceDescriptor: null });
  const [isKycScanning, setIsKycScanning] = useState(false);
  const [kycScanStatus, setKycScanStatus] = useState("Engine Ready");
  const [kycProgress, setKycProgress] = useState(0);
  const [isKycSubmitting, setIsKycSubmitting] = useState(false);

  const myTickets = (tickets || []).filter(t => t.userId === currentUser?.id);

  useEffect(() => {
    loadModels().then((success) => setModelsLoaded(success));
  }, []);

  useEffect(() => {
      let timer;
      if (config?.electionStatus === 'upcoming' && config?.electionStartTime) {
          timer = setInterval(() => {
              const now = new Date().getTime();
              const target = new Date(config.electionStartTime).getTime();
              const distance = target - now;
              
              if (distance < 0) {
                  setTimeLeft("Deployment Imminent...");
                  clearInterval(timer);
              } else {
                  const d = Math.floor(distance / (1000 * 60 * 60 * 24));
                  const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                  const s = Math.floor((distance % (1000 * 60)) / 1000);
                  setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
              }
          }, 1000);
      }
      return () => clearInterval(timer);
  }, [config]);

  if (!loggedInUserId) return <Navigate to="/login" replace />;
  if (!currentUser) return <div className="min-h-screen flex items-center justify-center text-[#000080] font-bold"><Loader2 className="animate-spin mr-2"/> Authenticating Session...</div>;
  if (currentUser.role === 'admin') return <Navigate to="/admin" replace />;

  const initiateVote = (id) => {
    if (config?.electionStatus !== 'active') return showToast("Voting channels are currently secured.", "error");
    if (!modelsLoaded) return showToast("Please wait, verification modules are initializing.", "info");
    setSelectedCandidate(id); setShowVerifyModal(true); setStatus('idle');
  };

  const verifyIdentity = async () => {
    setStatus('scanning');
    try {
      const liveDescriptor = await getFaceDescriptor(videoRef);
      if(!liveDescriptor || !currentUser.faceDescriptor) { 
          setStatus('failed'); 
          return; 
      }
      
      const distance = calculateDistance(currentUser.faceDescriptor, liveDescriptor);
      if (distance < 0.45) {
        setStatus('success'); 
        setTimeout(() => { 
            castVote(selectedCandidate); 
            setShowVerifyModal(false); 
        }, 1500);
      } else { 
          setStatus('failed'); 
      }
    } catch(e) { 
        console.error(e);
        setStatus('failed'); 
    }
  };

  const handleProfileImageChange = (e) => {
      const file = e.target.files[0];
      if (file) {
          if (file.size > 1048576) {
              showToast("Profile image must not exceed 1MB", "error");
              return;
          }
          const reader = new FileReader();
          reader.onloadend = () => { 
              updateProfile(currentUser.id, { photo: reader.result });
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSendPasswordResetLink = async (e) => {
      e.preventDefault();
      showToast("Dispatching secure recovery link...", "info");
      await sendEmail(currentUser.email, "Security Alert - ECI Portal", "A password recovery link has been requested for your official account. If unauthorized, contact support immediately.");
      setPassEmailSent(true);
      showToast("Recovery link dispatched to registered email.", "success");
      setTimeout(() => setPassEmailSent(false), 5000);
  };

  const handleSupportSubmit = async (e) => {
      e.preventDefault();
      const fullName = currentUser.firstName + " " + currentUser.lastName;
      await submitTicket(currentUser.id, fullName, currentUser.mobile, currentUser.email, supportMessage);
      
      sendEmail(currentUser.email, "Support Ticket Generated - ECI", `Dear ${fullName},\n\nYour grievance regarding "${supportMessage}" has been formally registered. Authorities will respond shortly.\n\nRegards,\nElection Commission Support`);

      setTicketSubmitted(true);
      setSupportMessage('');
      setTimeout(() => setTicketSubmitted(false), 5000);
  };

  const calculateResults = () => {
      if(!config || !config.votes) return [];
      const total = Object.values(config.votes).reduce((a,b)=>a+b, 0) || 1;
      return candidates.map(c => ({
          ...c, votes: config.votes[c.id] || 0, percentage: (((config.votes[c.id] || 0)/total)*100).toFixed(1)
      })).sort((a,b) => b.votes - a.votes);
  };

  const handleKycFileChange = (e) => {
    const file = e.target.files[0];
    if (file) { 
      if (file.size > 1048576) {
          showToast("Document must not exceed 1MB", "error");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => { setKycData({ ...kycData, aadharPhoto: reader.result }); };
      reader.readAsDataURL(file);
    }
  };

  const startKycScanning = async () => {
    if (!modelsLoaded) return alert("System engines are initializing. Please hold.");
    setIsKycScanning(true); setKycProgress(0); setKycScanStatus("Maintain facial alignment...");
    let scans = 0; const requiredScans = 10; let totalDescriptor = new Float32Array(128).fill(0);
    
    const interval = setInterval(async () => {
      if (scans >= requiredScans) {
        clearInterval(interval);
        const finalDescriptor = Array.from(totalDescriptor).map(val => val / requiredScans);
        setKycData(prev => ({ ...prev, faceDescriptor: finalDescriptor, facePhoto: captureFrame(kycVideoRef) }));
        setIsKycScanning(false); setKycScanStatus("Biometric Integration Complete.");
        return;
      }
      try {
        const descriptor = await getFaceDescriptor(kycVideoRef);
        if (descriptor) {
          for (let i = 0; i < 128; i++) totalDescriptor[i] += descriptor[i];
          scans++; setKycProgress(Math.round((scans / requiredScans) * 100)); setKycScanStatus(`Processing Geometry... ${Math.round((scans / requiredScans) * 100)}%`);
        } else { setKycScanStatus("Facial markers obscured."); }
      } catch (err) { clearInterval(interval); setIsKycScanning(false); setKycScanStatus("Optical hardware error."); }
    }, 300);
  };

  const submitKycUpdate = async () => {
    if(isKycSubmitting) return;
    setIsKycSubmitting(true);

    if (users && kycData.faceDescriptor) {
        const isDuplicateFace = users.some(user => {
            if (user.id === currentUser.id) return false; 
            if (!user.faceDescriptor) return false;
            return calculateDistance(user.faceDescriptor, kycData.faceDescriptor) < 0.38; 
        });
        if (isDuplicateFace) {
            showToast("Biometric collision detected with another profile.", "error");
            setIsKycSubmitting(false);
            return; 
        }
    }
    
    await requestKycUpdate(currentUser.id, kycData);
    setKycModalOpen(false);
    setIsKycSubmitting(false);
    setKycStep(1);
    setKycData({ aadharPhoto: null, facePhoto: null, faceDescriptor: null });
  };

  const VoterIDCard = () => (
    <div id="printable-id-card" className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 mt-8 relative transform transition-transform hover:scale-[1.02] print-area print:shadow-none print:border-none print:transform-none">
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#FF9933] via-white to-[#138808] z-20"></div>
      
      {/* Explicit Print Header to ensure it renders in print area */}
      <div className="flex flex-col items-center justify-center bg-white p-4 border-b-[4px] border-[#c0267a] w-full">
        <div className="w-full text-center pb-2 mb-2 border-b border-slate-100">
            <p className="text-xs md:text-sm font-black text-[#000080] uppercase tracking-[0.2em]">General Assembly Election</p>
        </div>
        <div className="flex items-center justify-center gap-3 w-full">
            <img src="/eci-logo.png" alt="ECI" className="w-12 h-12 object-contain" onError={(e) => {e.target.src='https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Election_Commission_of_India_Logo.svg/1024px-Election_Commission_of_India_Logo.svg.png'}}/>
            <div className="text-left flex flex-col justify-center">
                <h1 className="text-[14px] font-bold text-slate-800 leading-tight mb-0.5 tracking-wide">भारत निर्वाचन आयोग</h1>
                <h2 className="text-[10px] font-black text-slate-900 leading-tight tracking-wide uppercase">Election Commission of India</h2>
            </div>
        </div>
      </div>

      <div className="bg-[#000080] py-1.5 text-white text-center shadow-sm">
        <p className="text-[10px] font-black tracking-[0.2em] uppercase">e-EPIC (Electronic Electoral Photo ID Card)</p>
      </div>
      <div className="p-6 flex flex-col items-center bg-slate-50 relative">
        <div className="absolute top-4 right-4 text-[#000080] opacity-5"><ShieldCheck size={100}/></div>
        <div className="w-32 h-32 rounded-xl border-4 border-white shadow-lg overflow-hidden mb-4 z-10 bg-slate-200">
           {currentUser.photo ? <img src={currentUser.photo} className="w-full h-full object-cover" alt="Voter" /> : currentUser.facePhoto ? <img src={currentUser.facePhoto} className="w-full h-full object-cover" alt="Voter" /> : <div className="w-full h-full flex items-center justify-center text-slate-400">Photo</div>}
        </div>
        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight z-10">{currentUser.firstName} {currentUser.lastName}</h1>
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-1.5 rounded-lg font-mono text-sm font-bold mt-3 shadow-sm tracking-widest z-10">ECI{currentUser.id.slice(-6).toUpperCase()}</div>
        <div className="w-full grid grid-cols-2 gap-4 text-xs text-left bg-white p-4 rounded-xl mt-6 shadow-sm border border-slate-200 z-10">
          <p className="text-slate-500 font-bold uppercase">Mobile:<br/><b className="text-slate-800 font-mono text-sm">{mobile}</b></p>
          <p className="text-slate-500 font-bold uppercase">Aadhar:<br/><b className="text-slate-800 font-mono text-sm">XXXX XXXX {currentUser.aadharNo?.slice(-4)}</b></p>
          <p className="text-slate-500 font-bold uppercase col-span-2 text-center border-t pt-2 mt-2">D.O.B: <b className="text-slate-800 font-mono text-sm">{currentUser.dob || 'N/A'}</b></p>
        </div>
      </div>
      <div className="bg-gradient-to-r from-[#FF9933] to-orange-500 text-center text-white py-2 text-[10px] font-black tracking-[0.3em]">VALID FOR E-VOTING EXCLUSIVELY</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-20 md:pb-0">
      
      {/* RE-KYC MODAL */}
      {kycModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 flex flex-col items-center border-t-8 border-[#000080] shadow-2xl animate-fade-in-up relative overflow-hidden">
             <button onClick={() => setKycModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500"><X size={24}/></button>
             <h3 className="text-xl font-black mb-1 text-[#000080] uppercase tracking-wide">KYC Rectification</h3>
             
             {kycStep === 1 && (
                <div className="w-full mt-4 space-y-4 animate-fade-in text-center">
                    <p className="text-xs text-slate-500 font-bold mb-4">Phase 1: Secure Document Attachment</p>
                    <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 relative hover:bg-slate-50 transition-colors bg-white">
                      <input type="file" accept="image/*" onChange={handleKycFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"/>
                      {kycData.aadharPhoto ? (
                        <img src={kycData.aadharPhoto} className="h-32 mx-auto object-contain rounded shadow-md border border-slate-200" alt="Preview"/>
                      ) : (
                        <div><Upload size={40} className="mx-auto mb-3 text-[#000080] opacity-80"/><p className="text-sm text-slate-700 font-bold">Attach Aadhar</p></div>
                      )}
                    </div>
                    <button onClick={() => setKycStep(2)} disabled={!kycData.aadharPhoto} className="w-full bg-[#000080] text-white p-3.5 rounded-lg font-bold disabled:bg-slate-300 transition-all uppercase text-sm">Proceed to Biometrics</button>
                </div>
             )}

             {kycStep === 2 && (
                 <div className="w-full mt-4 space-y-4 animate-fade-in text-center">
                    <p className="text-xs text-slate-500 font-bold mb-4">Phase 2: Liveness Certification</p>
                    <div className="bg-slate-900 rounded-2xl flex flex-col items-center justify-center relative h-56 border-4 border-[#138808] overflow-hidden">
                        {kycData.facePhoto ? (
                            <img src={kycData.facePhoto} className="w-full h-full object-cover opacity-80" />
                        ) : (
                            <>
                                <NativeCamera videoRef={kycVideoRef} />
                                {isKycScanning && <div className="absolute top-0 left-0 h-1.5 bg-[#138808] w-full animate-pulse z-20"></div>}
                                {!isKycScanning && <button onClick={startKycScanning} className="absolute bottom-4 bg-[#000080] text-white px-4 py-2 rounded-full font-bold shadow-2xl border border-blue-400 text-xs z-30">Scan Features</button>}
                            </>
                        )}
                    </div>
                    <p className="text-xs font-bold text-[#000080]">{kycScanStatus}</p>
                    
                    <div className="flex gap-3 mt-4">
                        <button onClick={() => setKycStep(1)} className="flex-1 bg-slate-200 text-slate-700 p-3 rounded-lg font-bold hover:bg-slate-300">Return</button>
                        <button onClick={submitKycUpdate} disabled={!kycData.facePhoto || isKycSubmitting} className="flex-1 bg-[#138808] text-white p-3 rounded-lg font-bold disabled:bg-slate-300 flex justify-center items-center gap-2">
                           {isKycSubmitting ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>} Transmit
                        </button>
                    </div>
                 </div>
             )}
          </div>
        </div>
      )}

      {showVerifyModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 flex flex-col items-center border-t-8 border-[#000080] shadow-2xl animate-fade-in-up">
             <h3 className="text-xl font-black mb-1 text-[#000080] uppercase tracking-wide">Clearance Protocol</h3>
             <p className="text-xs text-slate-500 font-bold mb-6">Final cryptographic verification</p>
             <div className="relative w-56 h-56 bg-slate-900 rounded-full overflow-hidden mb-6 border-4 border-[#138808] shadow-inner flex items-center justify-center text-slate-500">
                <NativeCamera videoRef={videoRef} />
                {status === 'scanning' && <div className="absolute top-0 left-0 w-full h-2 bg-[#138808] shadow-[0_0_20px_#138808] animate-[scan_1.5s_ease-in-out_infinite] z-20"></div>}
             </div>
             {status === 'idle' && <button onClick={verifyIdentity} className="bg-[#000080] hover:bg-blue-900 text-white px-8 py-3.5 rounded-xl font-black shadow-lg w-full flex justify-center items-center gap-2 transition-all uppercase tracking-widest"><ScanFace size={20}/> Authorize Entry</button>}
             {status === 'scanning' && <p className="text-[#FF9933] font-black animate-pulse text-lg uppercase tracking-widest flex items-center gap-2"><Loader2 className="animate-spin"/> Analyzing...</p>}
             {status === 'failed' && <p className="text-red-600 font-bold bg-red-50 w-full text-center px-4 py-3 rounded-xl border border-red-200">Identification Invalid. <button onClick={()=>setStatus('idle')} className="underline ml-2 text-[#000080]">Retry Sequence</button></p>}
             {status === 'success' && <p className="text-[#138808] font-black text-xl flex items-center justify-center gap-2 w-full bg-green-50 px-6 py-3 rounded-xl border border-green-200 uppercase tracking-widest"><CheckCircle/> Access Granted!</p>}
             {status === 'idle' && <button onClick={()=>setShowVerifyModal(false)} className="mt-4 text-slate-400 hover:text-slate-600 font-bold text-sm uppercase transition-colors">Abort</button>}
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="bg-[#000080] shadow-md px-4 py-3 flex justify-between items-center sticky top-0 z-40 border-b-4 border-[#FF9933] no-print">
        <div className="flex items-center gap-3">
            <EciLogoSmall />
        </div>
        <div className="flex items-center gap-2 bg-blue-900/50 p-1.5 rounded-xl hidden md:flex">
           <button onClick={() => setActiveTab('vote')} className={`px-6 py-2 rounded-lg text-sm font-black uppercase transition-all ${activeTab === 'vote' ? 'bg-white text-[#000080] shadow-md' : 'text-blue-200 hover:bg-white/10'}`}>E-Ballot</button>
           <button onClick={() => setActiveTab('profile')} className={`px-6 py-2 rounded-lg text-sm font-black uppercase transition-all ${activeTab === 'profile' ? 'bg-white text-[#000080] shadow-md' : 'text-blue-200 hover:bg-white/10'}`}>e-EPIC Data</button>
           <button onClick={() => setActiveTab('support')} className={`px-6 py-2 rounded-lg text-sm font-black uppercase transition-all ${activeTab === 'support' ? 'bg-white text-[#000080] shadow-md' : 'text-blue-200 hover:bg-white/10'}`}>Helpdesk</button>
           <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-lg text-sm font-black uppercase transition-all ${activeTab === 'settings' ? 'bg-white text-[#000080] shadow-md' : 'text-blue-200 hover:bg-white/10'}`}><Settings size={18}/></button>
           <div className="w-px h-6 bg-blue-800 mx-1"></div>
           <button onClick={() => {logout(); navigate('/')}} className="text-blue-200 hover:text-red-400 px-3 py-2 rounded-lg transition-colors bg-red-900/30 ml-1"><LogOut size={20} /></button>
        </div>
      </nav>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around items-center p-3 pb-safe z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] no-print">
         <button onClick={() => setActiveTab('vote')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'vote' ? 'text-[#000080]' : 'text-slate-400'}`}><Fingerprint size={24}/><span className="text-[10px] font-black uppercase">Ballot</span></button>
         <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-[#000080]' : 'text-slate-400'}`}><FileText size={24}/><span className="text-[10px] font-black uppercase">e-EPIC</span></button>
         <button onClick={() => setActiveTab('support')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'support' ? 'text-[#000080]' : 'text-slate-400'}`}><MessageSquare size={24}/><span className="text-[10px] font-black uppercase">Support</span></button>
         <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-[#000080]' : 'text-slate-400'}`}><Settings size={24}/><span className="text-[10px] font-black uppercase">Config</span></button>
      </div>

      <main className="max-w-5xl mx-auto p-4 md:p-8 mb-20 md:mb-0">
        
        {activeTab === 'profile' && (
            <div className="text-center animate-fade-in-up">
                <div className="no-print">
                    <h2 className="text-3xl font-black text-[#000080] mb-2 uppercase tracking-widest">Electoral Identity Archive</h2>
                    <p className="text-slate-500 font-bold mb-6 uppercase text-xs">Official Digital Documentation</p>
                </div>
                <VoterIDCard />
                <button onClick={() => window.print()} className="no-print mt-8 bg-[#000080] hover:bg-blue-900 text-white px-8 py-3.5 rounded-xl inline-flex items-center gap-2 font-black shadow-lg transition-transform hover:-translate-y-1 uppercase tracking-widest"><Download size={20}/> Extract PDF Record</button>
            </div>
        )}

        {activeTab === 'support' && (
            <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in-up">
                <div className="bg-[#000080] p-6 text-center text-white border-b-4 border-[#FF9933]">
                    <MessageSquare size={48} className="mx-auto mb-3 opacity-90"/>
                    <h2 className="text-2xl font-black uppercase tracking-widest">Authority Helpdesk</h2>
                    <p className="text-blue-200 text-sm font-bold mt-1">Direct channel to Electoral Administration</p>
                </div>
                {ticketSubmitted ? (
                    <div className="p-8 text-center space-y-4 animate-fade-in">
                        <CheckCircle size={60} className="mx-auto text-[#138808]" />
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-wide">Communication Secured!</h3>
                        <p className="text-slate-500 text-sm font-medium">Administration will evaluate your grievance and establish contact via <b className="text-slate-700">{currentUser.mobile}</b> shortly.</p>
                        <button onClick={() => setTicketSubmitted(false)} className="mt-4 text-[#000080] font-black uppercase tracking-wide underline hover:text-[#FF9933] transition-colors">File Subsequent Query</button>
                    </div>
                ) : (
                    <form onSubmit={handleSupportSubmit} className="p-6 space-y-5 bg-slate-50">
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3 text-sm text-[#000080] font-bold shadow-sm">
                            <Info className="shrink-0 mt-0.5 text-blue-500"/>
                            Elaborate on operational discrepancies. ECI delegates actively monitor this channel.
                        </div>
                        <textarea required value={supportMessage} onChange={(e)=>setSupportMessage(e.target.value)} rows="4" className="w-full p-4 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#138808] outline-none font-medium resize-none shadow-inner" placeholder="Provide analytical breakdown of the issue..." />
                        <button type="submit" disabled={!supportMessage.trim()} className="w-full bg-[#138808] disabled:bg-slate-400 text-white py-4 rounded-xl font-black shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 uppercase tracking-widest">
                            <Upload size={20}/> Transmit Query
                        </button>
                    </form>
                )}

                {myTickets.length > 0 && (
                    <div className="border-t border-slate-200 p-6 bg-white animate-fade-in">
                        <h3 className="text-sm font-black text-slate-500 uppercase tracking-wider mb-4 text-center">Communication Ledger</h3>
                        <div className="space-y-4">
                            {myTickets.map(ticket => (
                                <div key={ticket.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left shadow-sm transition-all hover:border-slate-300">
                                    <p className="text-sm font-medium text-slate-700 mb-3 leading-relaxed">"{ticket.message}"</p>
                                    
                                    {ticket.status === 'resolved' && ticket.adminReply && (
                                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 mb-3">
                                            <span className="font-bold flex items-center gap-1 mb-1 text-[10px] uppercase tracking-widest"><ShieldCheck size={14}/> Official Directive</span>
                                            <p className="font-medium">"{ticket.adminReply}"</p>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center border-t border-slate-200 pt-3">
                                        {ticket.status === 'open' ? (
                                            <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 border border-orange-200">
                                                <Clock size={12}/> Processing
                                            </span>
                                        ) : (
                                            <span className="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 border border-green-200">
                                                <CheckCircle size={12}/> Concluded
                                            </span>
                                        )}
                                        {ticket.status === 'resolved' && (
                                            <button onClick={() => dismissTicket(ticket.id)} className="text-[10px] font-black text-slate-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded uppercase tracking-widest transition-colors flex items-center gap-1 border border-transparent hover:border-red-200">
                                                <X size={12}/> Purge
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto animate-fade-in-up">
             <h2 className="text-3xl font-black text-[#000080] mb-8 uppercase text-center tracking-widest">Configuration Matrix</h2>
             
             <div className="bg-white p-8 rounded-3xl shadow-sm mb-6 border border-slate-200 border-t-8 border-t-[#FF9933]">
                <h3 className="font-black text-lg text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wide"><Settings size={20} className="text-slate-500"/> Telemetry Data</h3>
                <form onSubmit={(e)=>{e.preventDefault(); updateProfile(currentUser.id, { mobile });}}>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Authorized Cellular Node</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input value={mobile} onChange={e=>setMobile(e.target.value)} className="flex-1 border border-slate-300 p-3.5 rounded-xl focus:ring-2 focus:ring-[#000080] outline-none font-bold text-slate-700 bg-slate-50" />
                        <button className="bg-[#000080] hover:bg-blue-900 text-white px-8 py-3.5 font-black rounded-xl shadow-md transition-colors uppercase tracking-widest">Synchronize</button>
                    </div>
                </form>
             </div>

             <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 border-t-8 border-t-[#138808] mb-6">
                <h3 className="font-black text-lg text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wide"><ShieldCheck size={20} className="text-[#138808]"/> Encryption Key</h3>
                <p className="text-sm text-slate-600 font-medium mb-6">Maintenance of core security algorithms mandates password resets to be channeled exclusively via encrypted electronic mail.</p>
                
                {passEmailSent ? (
                     <div className="bg-green-50 text-green-700 p-4 rounded-xl font-bold flex items-center gap-2 border border-green-200 animate-fade-in">
                         <CheckCircle size={20}/> Recovery package transmitted to {currentUser.email}
                     </div>
                ) : (
                    <form onSubmit={handleSendPasswordResetLink}>
                        <div className="mb-5">
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Official Email Destination</label>
                            <input type="email" readOnly value={currentUser.email} className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl text-slate-500 cursor-not-allowed font-bold" />
                        </div>
                        <button className="w-full bg-[#138808] hover:bg-green-700 text-white py-4 rounded-xl font-black shadow-md transition-colors flex justify-center items-center gap-2 uppercase tracking-widest">
                            <Mail size={18}/> Request Cryptographic Reset
                        </button>
                    </form>
                )}
             </div>

             {currentUser.status !== 'pending' && (
                 <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 border-t-8 border-t-blue-500 mb-6">
                    <h3 className="font-black text-lg text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wide"><ScanFace size={20} className="text-blue-500"/> Biometric Recalibration</h3>
                    <p className="text-sm text-slate-600 font-medium mb-6">Initiating a Re-KYC procedure will temporarily revoke voting privileges pending manual authorization by the Electoral Board.</p>
                    <button onClick={() => setKycModalOpen(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black shadow-md transition-colors flex justify-center items-center gap-2 uppercase tracking-widest">
                        <RefreshCw size={18}/> Initiate System Recalibration
                    </button>
                 </div>
             )}
          </div>
        )}

        {activeTab === 'vote' && (
          <div className="animate-fade-in-up">
            
            {currentUser.status === 'pending' ? (
                <div className="text-center py-24 bg-white rounded-[2.5rem] shadow-sm border border-yellow-200 max-w-3xl mx-auto">
                    <Loader2 className="w-20 h-20 text-[#FF9933] mx-auto mb-6 animate-spin"/>
                    <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tight">Authorization Pending</h2>
                    <p className="text-slate-500 font-bold mt-4 uppercase tracking-widest">Credential validation in progress.<br/>Ballot access is temporarily restricted.</p>
                </div>
            ) : currentUser.status === 'rejected' ? (
                <div className="text-center py-24 bg-white rounded-[2.5rem] shadow-sm border border-red-200 max-w-3xl mx-auto">
                    <ShieldAlert className="w-20 h-20 text-red-500 mx-auto mb-6"/>
                    <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tight">Credentials Invalidated</h2>
                    <p className="text-slate-500 font-bold mt-4 uppercase tracking-widest">Documentation audit failed.<br/>Navigate to configurations for mandatory Re-KYC.</p>
                    <button onClick={() => setActiveTab('settings')} className="mt-6 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest">Access Configurations</button>
                </div>
            ) : (
                <>
                    {config && config.resultsPublished && (
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8 transform transition-all">
                            <div className="bg-[#000080] p-6 text-white text-center border-b-4 border-[#FF9933]"><BarChart3 size={40} className="mx-auto mb-3 opacity-90"/><h2 className="text-2xl font-black uppercase tracking-widest">Official Mandate Declared</h2></div>
                            <div className="p-6 md:p-8 space-y-6 bg-slate-50">
                                {calculateResults().map((c, index) => {
                                     const total = Object.values(config.votes || {}).reduce((a,b)=>a+b,0) || 1;
                                     const percentage = ((c.votes/total)*100).toFixed(1);
                                     return (
                                        <div key={c.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                                            {index === 0 && c.votes > 0 && <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-black px-4 py-1.5 uppercase tracking-widest rounded-bl-xl shadow-sm">Frontrunner</div>}
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-4xl bg-slate-100 w-16 h-16 flex items-center justify-center rounded-full border shadow-sm">{c.symbol}</span>
                                                    <div><p className="font-black uppercase text-slate-800 text-xl">{c.party}</p><p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{c.name}</p></div>
                                                </div>
                                                <div className="text-right"><p className="text-4xl font-black text-[#138808]">{c.votes}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Count</p></div>
                                            </div>
                                            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border inset-shadow relative">
                                                <div className="h-full bg-gradient-to-r from-[#FF9933] via-[#ffb366] to-[#138808] transition-all duration-1000 ease-out" style={{width: `${percentage}%`}}></div>
                                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-700 drop-shadow-sm">{percentage}%</span>
                                            </div>
                                        </div>
                                     )
                                })}
                            </div>
                        </div>
                    )}

                    {currentUser.hasVoted ? (
                      <div className="max-w-2xl mx-auto text-center py-12 bg-white rounded-[2.5rem] shadow-xl border border-green-100 overflow-hidden relative">
                         <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-[#FF9933] via-white to-[#138808]"></div>
                         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
                         
                         <div className="w-28 h-28 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 mt-4 shadow-inner border-4 border-green-100 relative z-10">
                            <CheckCircle className="w-16 h-16 text-[#138808]"/>
                         </div>
                         <h2 className="text-4xl font-black text-[#000080] mb-2 uppercase tracking-tight relative z-10">Mandate Registered!</h2>
                         <p className="text-slate-500 font-bold tracking-wide relative z-10">Your cryptographic ballot has been irreversibly sealed in the ledger.</p>
                         
                         <div className="mt-8 bg-slate-50 border border-slate-200 p-8 rounded-3xl mx-6 md:mx-12 shadow-inner relative z-10">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex justify-center items-center gap-2"><ShieldCheck size={18} className="text-[#000080]"/> Encrypted VVPAT Hash</p>
                            <p className="font-mono text-sm md:text-base text-[#138808] font-bold break-all bg-white p-5 rounded-xl border border-green-200 shadow-sm select-all">{currentUser.voteHash || "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"}</p>
                         </div>
                      </div>
                    ) : (
                      (!config || !config.resultsPublished) && (
                          <>
                            
                            {config?.electionStatus === 'upcoming' && (
                                <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-slate-200">
                                    {config?.electionStartTime ? (
                                        <>
                                            <Timer className="w-20 h-20 text-[#FF9933] mx-auto mb-4 opacity-80 animate-pulse"/>
                                            <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tight mb-2">Polling Commences In</h2>
                                            <div className="text-5xl font-mono text-[#000080] font-black tracking-widest bg-slate-50 border border-slate-200 inline-block px-8 py-4 rounded-2xl shadow-inner">{timeLeft || 'Calculating...'}</div>
                                        </>
                                    ) : (
                                        <>
                                            <Clock className="w-24 h-24 text-[#FF9933] mx-auto mb-6 opacity-80 animate-pulse-slow"/>
                                            <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tight">Polling Scheduled</h2>
                                            <p className="text-slate-500 font-bold mt-3 uppercase tracking-widest">Electronic voting channels have not been initialized by authorities.</p>
                                        </>
                                    )}
                                </div>
                            )}
                            
                            {config?.electionStatus === 'completed' && <div className="text-center py-24 bg-white rounded-3xl shadow-sm border border-slate-200"><Lock className="w-24 h-24 text-[#000080] mx-auto mb-6 opacity-80"/><h2 className="text-4xl font-black text-slate-800 uppercase tracking-tight">Polling Concluded</h2><p className="text-slate-500 font-bold mt-3 uppercase tracking-widest">Ballot submission channels are permanently sealed. Pending analysis.</p></div>}
                            
                            {config?.electionStatus === 'active' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {candidates.map(c => (
                                        <div key={c.id} className="bg-white rounded-3xl shadow-md hover:shadow-2xl transition-all overflow-hidden border border-slate-200 group flex flex-col transform hover:-translate-y-2 relative">
                                            <div className="h-56 relative p-6 flex items-center justify-center border-b border-slate-200 overflow-hidden bg-slate-100">
                                                {c.backgroundUrl ? (
                                                  <div className="absolute inset-0 z-0">
                                                    <img src={c.backgroundUrl} className="w-full h-full object-cover opacity-20" alt="background"/>
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-100 via-transparent to-transparent"></div>
                                                  </div>
                                                ) : (
                                                  <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-100 to-slate-200"></div>
                                                )}
                                                
                                                <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-white shadow-xl z-10 bg-slate-300 relative">
                                                    {c.photo ? <img src={c.photo} className="w-full h-full object-cover" onError={(e)=>e.target.style.display='none'}/> : null}
                                                </div>
                                                <div className="absolute top-4 right-4 w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-4xl border-2 border-[#FF9933] group-hover:scale-125 transition-transform duration-300 z-10">
                                                    {c.symbol}
                                                </div>
                                            </div>
                                            <div className="p-8 flex-1 flex flex-col justify-between bg-white z-10">
                                                <div className="text-center mb-8">
                                                    <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tight leading-tight">{c.name}</h3>
                                                    <p className="text-[#FF9933] font-black tracking-widest text-sm uppercase mt-2">{c.party}</p>
                                                </div>
                                                <button onClick={() => initiateVote(c.id)} className="w-full py-4 bg-slate-50 border-2 border-[#000080] text-[#000080] group-hover:bg-[#000080] group-hover:text-white font-black rounded-xl uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2">
                                                    <Fingerprint size={20}/> ENDORSE BALLOT
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                          </>
                      )
                    )}
                </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

// =========================================================================
// 8. ADMIN DASHBOARD
// =========================================================================
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { currentUser, loggedInUserId, users, logs, candidates, config, tickets, updateConfig, approveUser, rejectUser, deleteUser, addCandidate, updateCandidate, deleteCandidate, logout, resetElection, clearLogs, resolveTicket, showToast } = useVoting();
  
  const [activeTab, setActiveTab] = useState('voters');
  const [voterSubTab, setVoterSubTab] = useState('pending');
  
  const [newCandidate, setNewCandidate] = useState({ name: '', party: '', symbol: '', photo: '', backgroundUrl: '' });
  const [editingCandidateId, setEditingCandidateId] = useState(null);
  
  const [viewImage, setViewImage] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [voteFilter, setVoteFilter] = useState('all');

  const [ticketReplies, setTicketReplies] = useState({});

  // Timer state for Admin
  const [adminTimerInput, setAdminTimerInput] = useState('');

  const [seenCounts, setSeenCounts] = useState(() => {
      const saved = localStorage.getItem('adminSeenCounts');
      return saved ? JSON.parse(saved) : { voters: users.length, candidates: candidates.length, logs: logs.length, tickets: (tickets || []).length };
  });

  useEffect(() => {
      setSeenCounts(prev => {
          const updated = { ...prev };
          let changed = false;
          if (activeTab === 'voters' && prev.voters !== users.length) { updated.voters = users.length; changed = true; }
          if (activeTab === 'candidates' && prev.candidates !== candidates.length) { updated.candidates = candidates.length; changed = true; }
          if (activeTab === 'logs' && prev.logs !== logs.length) { updated.logs = logs.length; changed = true; }
          if (activeTab === 'tickets' && prev.tickets !== (tickets || []).length) { updated.tickets = (tickets || []).length; changed = true; }
          return changed ? updated : prev;
      });
  }, [users.length, candidates.length, logs.length, tickets?.length, activeTab]);

  useEffect(() => {
      localStorage.setItem('adminSeenCounts', JSON.stringify(seenCounts));
  }, [seenCounts]);

  const handleTabChange = (tab) => {
      setActiveTab(tab);
  };

  const handleCandidateSubmit = (e) => {
      e.preventDefault();
      if(editingCandidateId) {
          updateCandidate(editingCandidateId, newCandidate);
          setEditingCandidateId(null);
      } else {
          addCandidate(newCandidate);
      }
      setNewCandidate({ name: '', party: '', symbol: '', photo: '', backgroundUrl: '' });
  };

  const startEditCandidate = (c) => {
      setNewCandidate({ name: c.name, party: c.party, symbol: c.symbol, photo: c.photo, backgroundUrl: c.backgroundUrl || '' });
      setEditingCandidateId(c.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSetTimer = () => {
      updateConfig({ electionStartTime: adminTimerInput });
      showToast("Deployment timeline synchronized.", "success");
  };

  const unseenVoters = Math.max(0, users.length - (seenCounts.voters || 0));
  const unseenCandidates = Math.max(0, candidates.length - (seenCounts.candidates || 0));
  const unseenLogs = Math.max(0, logs.length - (seenCounts.logs || 0));
  const unseenTickets = Math.max(0, (tickets || []).length - (seenCounts.tickets || 0));

  if (!loggedInUserId) return <Navigate to="/login" replace />;
  if (!currentUser) return <div className="min-h-screen flex items-center justify-center text-[#000080] font-bold"><Loader2 className="animate-spin mr-2"/> Authenticating Administrator...</div>;
  if (currentUser.role !== 'admin') return <Navigate to="/login" replace />;

  const pendingUsers = users.filter(u => u.status === 'pending');
  const approvedUsers = users.filter(u => u.status === 'approved');
  const openTickets = (tickets || []).filter(t => t.status === 'open');

  const handlePublishResults = () => {
    if(window.confirm("Execute global broadcast of analytical results?")) updateConfig({ resultsPublished: !config.resultsPublished });
  };
  
  const handleResetElection = async () => {
      if(window.confirm("CRITICAL WARNING: This action triggers a full ledger purge. All current cryptographic ballots will be permanently deleted. Execute protocol?")) {
          await resetElection();
      }
  };

  const calculateResults = () => {
    if(!config || !config.votes) return [];
    return candidates.map(c => ({...c, votes: config.votes[c.id] || 0 })).sort((a,b) => b.votes - a.votes);
  };

  const processedUsers = users
      .filter(u => {
          const matchesSearch = (u.firstName + ' ' + u.lastName).toLowerCase().includes(searchQuery.toLowerCase()) || (u.aadharNo && u.aadharNo.includes(searchQuery));
          const matchesVote = voteFilter === 'all' ? true : (voteFilter === 'voted' ? u.hasVoted : !u.hasVoted);
          return matchesSearch && matchesVote;
      })
      .sort((a, b) => {
          const nameA = (a.firstName + ' ' + a.lastName).toLowerCase();
          const nameB = (b.firstName + ' ' + b.lastName).toLowerCase();
          if (sortOrder === 'asc') return nameA.localeCompare(nameB);
          else return nameB.localeCompare(nameA);
      });

  // Calculate Turnout
  const totalApproved = approvedUsers.length;
  const totalVoted = approvedUsers.filter(u => u.hasVoted).length;
  const turnoutPercentage = totalApproved > 0 ? ((totalVoted / totalApproved) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col md:flex-row relative">
      
      {viewImage && (
          <div className="fixed inset-0 bg-black/90 z-[500] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setViewImage(null)}>
              <button className="absolute top-6 right-6 text-white bg-slate-800 hover:bg-red-600 p-2 rounded-full transition-colors"><X size={24}/></button>
              <img src={viewImage} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-slate-700" alt="Zoomed Document" onClick={(e) => e.stopPropagation()} />
              <p className="text-white/60 text-sm font-bold mt-4 tracking-widest uppercase">Disengage focus to close</p>
          </div>
      )}

      {/* FIXED SIDEBAR */}
      <aside className="w-full md:w-72 bg-[#000080] text-white flex flex-col shadow-2xl relative z-20 shrink-0 md:h-screen md:sticky md:top-0 overflow-y-auto custom-scrollbar">
        <div className="bg-white pt-8 pb-6 px-4 border-b-4 border-[#FF9933]"><EciAdminSidebarLogo /></div>
        <nav className="flex-1 p-4 space-y-2 mt-4">
          <button onClick={() => handleTabChange('voters')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-black uppercase tracking-wide transition-all ${activeTab === 'voters' ? 'bg-white text-[#000080] shadow-md' : 'hover:bg-blue-900/50 text-blue-100'}`}>
              <Users size={20}/> Registry Audit {unseenVoters > 0 && <span className="ml-auto bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">Alert {unseenVoters}</span>}
          </button>
          <button onClick={() => handleTabChange('candidates')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-black uppercase tracking-wide transition-all ${activeTab === 'candidates' ? 'bg-white text-[#000080] shadow-md' : 'hover:bg-blue-900/50 text-blue-100'}`}>
              <UserPlus size={20}/> Factions Configuration {unseenCandidates > 0 && <span className="ml-auto bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">Alert {unseenCandidates}</span>}
          </button>
          <button onClick={() => handleTabChange('election')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-black uppercase tracking-wide transition-all ${activeTab === 'election' ? 'bg-white text-[#000080] shadow-md' : 'hover:bg-blue-900/50 text-blue-100'}`}>
              <Activity size={20}/> Deployment Protocols
          </button>
          <button onClick={() => handleTabChange('tickets')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-black uppercase tracking-wide transition-all ${activeTab === 'tickets' ? 'bg-white text-[#000080] shadow-md' : 'hover:bg-blue-900/50 text-blue-100'}`}>
              <Ticket size={20}/> Grievance Operations {unseenTickets > 0 && <span className="ml-auto bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">Alert {unseenTickets}</span>}
          </button>
          <button onClick={() => handleTabChange('results')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-black uppercase tracking-wide transition-all ${activeTab === 'results' ? 'bg-white text-[#000080] shadow-md' : 'hover:bg-blue-900/50 text-blue-100'}`}>
              <BarChart3 size={20}/> Real-Time Metrics
          </button>
          <button onClick={() => handleTabChange('logs')} className={`w-full flex items-center gap-3 p-3.5 rounded-xl font-black uppercase tracking-wide transition-all ${activeTab === 'logs' ? 'bg-white text-[#000080] shadow-md' : 'hover:bg-blue-900/50 text-blue-100'}`}>
              <ShieldAlert size={20}/> Forensic Audit Trail {unseenLogs > 0 && <span className="ml-auto bg-red-500 text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">Alert {unseenLogs}</span>}
          </button>
        </nav>
        <div className="p-4 border-t border-blue-900/50"><button onClick={() => {logout(); navigate('/login');}} className="w-full bg-red-600/90 text-white p-3.5 rounded-xl font-black uppercase tracking-wider hover:bg-red-600 flex justify-center items-center gap-2 transition-colors"><LogOut size={18}/> Disengage Session</button></div>
      </aside>

      <main className="flex-1 bg-slate-50/50 relative w-full">
        <header className="bg-white p-6 shadow-sm border-b border-slate-200 flex justify-between items-center sticky top-0 z-10 backdrop-blur-md bg-white/90">
            <div className="flex items-center gap-4">
               <div><h1 className="text-2xl font-black uppercase tracking-tight text-slate-800">Chief Electoral Officer</h1><p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Master Surveillance Node</p></div>
               {pendingUsers.length > 0 && (
                 <div className="ml-4 bg-red-50 text-red-600 px-4 py-1.5 rounded-full border border-red-200 flex items-center gap-2 shadow-sm animate-pulse cursor-pointer hidden sm:flex" onClick={() => {handleTabChange('voters'); setVoterSubTab('pending');}}>
                    <ShieldAlert size={16}/>
                    <span className="text-xs font-black uppercase tracking-wider">Attention: {pendingUsers.length} Audit Queued</span>
                 </div>
               )}
            </div>
            <div className="flex items-center gap-3">
               {/* Email Service API Toggle */}
               <div className="hidden sm:flex items-center gap-2 mr-4 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Email API:</span>
                    <button onClick={() => updateConfig({ emailServiceEnabled: !config?.emailServiceEnabled })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-inner border border-black/10 ${config?.emailServiceEnabled ? 'bg-[#138808]' : 'bg-slate-300'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${config?.emailServiceEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-[10px] font-black uppercase ${config?.emailServiceEnabled ? 'text-[#138808]' : 'text-slate-400'}`}>{config?.emailServiceEnabled ? 'Active' : 'Offline'}</span>
               </div>

               <div className="text-right hidden sm:block"><p className="text-sm font-black text-slate-800">Root_Admin</p><p className="text-[10px] text-[#138808] font-black uppercase tracking-widest flex items-center gap-1 justify-end"><CheckCircle size={10}/> Authority Active</p></div>
               <div className="w-12 h-12 bg-[#000080] text-white rounded-xl flex items-center justify-center font-black text-xl shadow-md">AD</div>
            </div>
        </header>

        <div className="p-4 md:p-8">
          {activeTab === 'voters' && (
            <div className="animate-fade-in-up">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                 <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 border-l-8 border-l-[#FF9933] relative overflow-hidden"><div className="absolute right-0 top-0 text-orange-100 -mr-4 -mt-4"><Users size={100}/></div><p className="text-sm font-black text-slate-500 uppercase tracking-wider mb-1 relative z-10">Global Registry</p><p className="text-4xl font-black text-slate-800 relative z-10">{users.length}</p></div>
                 <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 border-l-8 border-l-[#000080] relative overflow-hidden"><div className="absolute right-0 top-0 text-blue-50 -mr-4 -mt-4"><Shield size={100}/></div><p className="text-sm font-black text-slate-500 uppercase tracking-wider mb-1 relative z-10">Pending Clearance</p><p className="text-4xl font-black text-[#000080] relative z-10">{pendingUsers.length}</p></div>
                 <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 border-l-8 border-l-[#138808] relative overflow-hidden"><div className="absolute right-0 top-0 text-green-50 -mr-4 -mt-4"><CheckCircle size={100}/></div><p className="text-sm font-black text-slate-500 uppercase tracking-wider mb-1 relative z-10">Cleared Electors</p><p className="text-4xl font-black text-[#138808] relative z-10">{approvedUsers.length}</p></div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-6 border-b border-slate-200 pb-4">
                  <button onClick={() => setVoterSubTab('pending')} className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-2 transition-colors ${voterSubTab === 'pending' ? 'bg-[#000080] text-white shadow-md' : 'bg-white border text-slate-500 hover:bg-slate-50'}`}><ShieldAlert size={18}/> Manual Clearance Queue <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs">({pendingUsers.length})</span></button>
                  <button onClick={() => { setVoterSubTab('all'); handleTabChange('voters'); }} className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-2 transition-colors ${voterSubTab === 'all' ? 'bg-[#000080] text-white shadow-md' : 'bg-white border text-slate-500 hover:bg-slate-50'}`}><ListFilter size={18}/> Global Database Directory <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs">({users.length})</span></button>
              </div>

              {voterSubTab === 'pending' ? (
                <div className="space-y-6">
                    {pendingUsers.length === 0 ? <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm"><CheckCircle className="mx-auto w-16 h-16 text-[#138808] opacity-50 mb-3"/><p className="text-lg font-black text-slate-500 uppercase">Clearance queue is vacant.</p></div> : 
                     pendingUsers.map(user => (
                        <div key={user.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl flex flex-col xl:flex-row gap-8 relative overflow-hidden">
                            <div className="flex-1 space-y-4 z-10">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-2xl font-black text-[#000080] uppercase">{user.firstName} {user.lastName}</h3>
                                        {user.backupKyc && <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-3 py-1 rounded-full border border-purple-200 uppercase tracking-widest shadow-sm"><RefreshCw size={10} className="inline mr-1 mb-0.5"/> RE-CALIBRATION REQUEST</span>}
                                    </div>
                                    <p className="font-mono text-lg font-bold text-slate-600 bg-slate-100 inline-block px-3 py-1 rounded-lg border border-slate-200">UIDAI: {user.aadharNo}</p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-bold text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner"><p>Node: <span className="text-slate-800">{user.mobile}</span></p><p>Address: <span className="text-slate-800">{user.email}</span></p><p className="col-span-1 sm:col-span-2">Origin Date: <span className="text-slate-800">{user.dob || 'N/A'}</span></p></div>
                                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200">
                                    <button onClick={() => approveUser(user.id)} className="flex-1 bg-[#138808] hover:bg-green-700 text-white py-3.5 rounded-xl font-black uppercase tracking-widest shadow-md transition-colors">Authorize Inclusion</button>
                                    <button onClick={() => rejectUser(user.id)} className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-200 py-3.5 rounded-xl font-black uppercase tracking-widest transition-colors">{user.backupKyc ? "Deny & Restore Data" : "Deny Clearance"}</button>
                                    {!user.backupKyc && <button onClick={() => { if(window.confirm(`Initiate permanent deletion protocol for ${user.firstName}?`)) deleteUser(user.id); }} className="px-6 py-3.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-xl transition-colors shadow-sm" title="Delete User Permanently"><Trash2 size={22} className="mx-auto"/></button>}
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner z-10">
                                <div className="text-center group relative cursor-pointer" onClick={() => setViewImage(user.aadharPhoto)}>
                                    <p className="text-xs font-black text-slate-500 uppercase mb-2">Attached Proof</p>
                                    <div className="w-48 h-32 bg-slate-200 rounded-xl overflow-hidden border-4 border-white shadow-md relative">
                                        <img src={user.aadharPhoto} className="w-full h-full object-cover" onError={(e)=>e.target.style.display='none'}/>
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="text-white" size={24}/></div>
                                    </div>
                                </div>
                                <div className="w-10 flex justify-center text-slate-300 rotate-90 sm:rotate-0"><RefreshCw size={24}/></div>
                                <div className="text-center group relative cursor-pointer" onClick={() => setViewImage(user.facePhoto)}>
                                    <p className="text-xs font-black text-[#000080] uppercase mb-2">Live Scan</p>
                                    <div className="w-32 h-32 bg-slate-200 rounded-full overflow-hidden border-4 border-[#000080] shadow-md relative">
                                        <img src={user.facePhoto} className="w-full h-full object-cover" onError={(e)=>e.target.style.display='none'}/>
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Maximize2 className="text-white" size={24}/></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                     <input 
                         type="text" 
                         placeholder="Query parameters..." 
                         value={searchQuery}
                         onChange={(e) => setSearchQuery(e.target.value)}
                         className="p-2.5 border border-slate-300 rounded-lg w-full md:w-1/3 focus:ring-2 focus:ring-[#000080] outline-none text-sm font-bold text-slate-700"
                     />
                     <div className="flex gap-2 w-full md:w-auto">
                         <select value={voteFilter} onChange={(e) => setVoteFilter(e.target.value)} className="bg-white border border-slate-300 text-slate-700 px-3 py-2.5 rounded-lg text-sm font-bold outline-none flex-1 md:flex-none">
                             <option value="all">Complete Registry</option>
                             <option value="voted">Endorsed Only</option>
                             <option value="not_voted">Awaiting Endorsement</option>
                         </select>
                         <button 
                             onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} 
                             className="bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-100 transition-colors flex-1 md:flex-none"
                         >
                             <ListFilter size={16}/> Sequence: {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                         </button>
                     </div>
                  </div>
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500 font-black"><tr className="border-b"><th className="p-5">Elector Entity</th><th className="p-5">UIDAI Parameters</th><th className="p-5 text-center">Engagement Status</th><th className="p-5 text-center">Authorization</th><th className="p-5 text-center">Execute</th></tr></thead>
                    <tbody>
                      {processedUsers.length === 0 ? <tr><td colSpan="5" className="p-10 text-center font-bold text-slate-400">Zero matches discovered.</td></tr> : 
                       processedUsers.map(user => (
                        <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="p-5">
                            <p className="font-black text-slate-800 uppercase">{user.firstName} {user.lastName}</p>
                            <p className="text-xs font-bold text-slate-500">{user.email} | {user.mobile}</p>
                          </td>
                          <td className="p-5"><p className="font-mono text-sm font-bold text-slate-600">{user.aadharNo}</p><p className="text-xs font-bold text-slate-500">DOB: {user.dob || 'N/A'}</p></td>
                          <td className="p-5 text-center">{user.hasVoted ? <span className="text-[#138808] font-black uppercase text-xs tracking-wider flex items-center justify-center gap-1"><CheckCircle size={14}/> Sealed</span> : <span className="text-slate-400 font-bold uppercase text-xs tracking-wider">Vacant</span>}</td>
                          <td className="p-5 text-center">
                            {user.status === 'pending' && user.backupKyc ? <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-3 py-1.5 rounded-lg border border-purple-200 uppercase tracking-widest">Re-Audit</span> :
                             <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${user.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : user.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>{user.status}</span>
                            }
                          </td>
                          <td className="p-5 text-center">
                              <button onClick={() => { if(window.confirm(`Initiate permanent deletion protocol for ${user.firstName}?`)) deleteUser(user.id); }} className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Delete Voter">
                                  <Trash2 size={18}/>
                              </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 gap-4">
                 <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-wide flex items-center gap-2"><Ticket className="text-[#FF9933]"/> Grievance Surveillance</h3>
                    <p className="text-sm text-slate-500">Monitor and orchestrate responses to elector discrepancies.</p>
                 </div>
                 <div className="flex gap-4 bg-white p-2 rounded-lg border border-slate-200 shadow-sm w-full sm:w-auto justify-around">
                    <div className="text-center px-4 border-r"><p className="text-xs font-bold text-slate-400 uppercase">Active</p><p className="font-black text-orange-500 text-lg">{openTickets.length}</p></div>
                    <div className="text-center px-4"><p className="text-xs font-bold text-slate-400 uppercase">Dispatched</p><p className="font-black text-green-500 text-lg">{(tickets || []).length - openTickets.length}</p></div>
                 </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500 font-black">
                      <tr className="border-b border-slate-200">
                         <th className="p-4">Entity Details</th>
                         <th className="p-4 w-1/2">Anomaly & Directive</th>
                         <th className="p-4 text-center">State</th>
                         <th className="p-4 text-right">Execute</th>
                      </tr>
                    </thead>
                    <tbody>
                        {(tickets || []).length === 0 ? (
                           <tr><td colSpan="4" className="p-8 text-center text-slate-500 italic font-medium">Log empty. System operating optimally.</td></tr>
                        ) : (
                           (tickets || []).map(ticket => (
                              <tr key={ticket.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                 <td className="p-4 align-top">
                                     <p className="font-black text-slate-800">{ticket.userName}</p>
                                     <p className="text-xs font-bold text-slate-500 flex items-center gap-1 mt-1"><Phone size={12}/> {ticket.userMobile}</p>
                                     <p className="text-[10px] text-slate-400 font-bold mt-3">{new Date(ticket.createdAt).toLocaleString()}</p>
                                 </td>
                                 <td className="p-4">
                                     <div className="bg-orange-50 text-orange-900 p-3 rounded-lg border border-orange-100 text-sm font-medium whitespace-normal mb-3">
                                        "{ticket.message}"
                                     </div>
                                     
                                     {ticket.status === 'open' ? (
                                         <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                placeholder="Draft official directive..." 
                                                value={ticketReplies[ticket.id] || ''}
                                                onChange={e => setTicketReplies({...ticketReplies, [ticket.id]: e.target.value})}
                                                className="flex-1 p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#000080] outline-none"
                                            />
                                         </div>
                                     ) : (
                                        <div className="bg-green-50 p-2 rounded-lg border border-green-100 text-sm text-green-800 font-medium flex gap-2 items-start">
                                            <ShieldCheck size={16} className="mt-0.5 shrink-0"/>
                                            <p>Directive Issued: {ticket.adminReply}</p>
                                        </div>
                                     )}
                                 </td>
                                 <td className="p-4 text-center align-top">
                                     {ticket.status === 'open' ? 
                                       <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Active</span> : 
                                       <span className="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Concluded</span>
                                     }
                                 </td>
                                 <td className="p-4 text-right align-top">
                                     {ticket.status === 'open' && (
                                         <button onClick={() => resolveTicket(ticket, ticketReplies[ticket.id])} className="bg-white border border-slate-300 text-slate-700 hover:text-white hover:border-green-600 hover:bg-green-600 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 ml-auto w-full sm:w-auto">
                                            <Send size={14}/> Dispatch Command
                                         </button>
                                     )}
                                 </td>
                              </tr>
                           ))
                        )}
                    </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'candidates' && (
              <div className="flex flex-col xl:flex-row gap-8 animate-fade-in-up">
                  <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8">
                      <h3 className="font-black text-xl mb-6 text-[#000080] uppercase tracking-wide border-b pb-4 flex justify-between items-center">Active Factions <span className="bg-blue-50 text-blue-700 px-3 py-1 text-sm rounded-lg">{candidates.length} Online</span></h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {candidates.map(c => (
                              <div key={c.id} className={`border ${editingCandidateId === c.id ? 'border-[#000080] bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white'} rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow relative overflow-hidden`}>
                                {c.backgroundUrl && <img src={c.backgroundUrl} className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none" alt="party background" />}
                                
                                <div className="flex items-center gap-4 relative z-10">
                                   <img src={c.photo || "https://via.placeholder.com/50"} className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 bg-slate-100"/>
                                   <div>
                                       <p className="font-black text-slate-800 uppercase tracking-tight">{c.name}</p>
                                       <p className="text-sm font-bold text-[#FF9933]">{c.party} <span className="text-slate-400">|</span> Node: {c.symbol}</p>
                                   </div>
                                </div>
                                <div className="flex flex-col gap-2 relative z-10">
                                    <button onClick={() => startEditCandidate(c)} className="p-2 text-slate-400 hover:text-[#000080] hover:bg-blue-50 rounded-lg transition-colors bg-white border border-slate-200 shadow-sm" title="Modify Configuration"><Edit size={16}/></button>
                                    <button onClick={() => {if(window.confirm("Execute entity removal?")) deleteCandidate(c.id);}} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors bg-white border border-slate-200 shadow-sm" title="Terminate Entity"><Trash2 size={16}/></button>
                                </div>
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="w-full xl:w-[450px] bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 border-t-8 border-t-[#138808] self-start sticky top-28 transition-all">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-xl text-slate-800 uppercase tracking-wide flex items-center gap-2">
                            {editingCandidateId ? <><Edit size={24} className="text-[#138808]"/> Modify Parameters</> : <><UserPlus size={24} className="text-[#138808]"/> Initialize Entity</>}
                        </h3>
                        {editingCandidateId && <button onClick={() => {setEditingCandidateId(null); setNewCandidate({ name: '', party: '', symbol: '', photo: '', backgroundUrl: '' });}} className="text-xs font-bold text-slate-400 hover:text-slate-600 underline">Abort Modification</button>}
                      </div>
                      <form onSubmit={handleCandidateSubmit} className="space-y-5">
                          <div><label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Entity Designation</label><input type="text" required value={newCandidate.name} onChange={e=>setNewCandidate({...newCandidate, name:e.target.value})} className="w-full border border-slate-300 bg-slate-50 p-3.5 rounded-xl font-bold focus:bg-white focus:ring-2 focus:ring-[#138808] outline-none" placeholder="E.g. Narendra Modi" /></div>
                          <div><label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Faction Alliance</label><input type="text" required value={newCandidate.party} onChange={e=>setNewCandidate({...newCandidate, party:e.target.value})} className="w-full border border-slate-300 bg-slate-50 p-3.5 rounded-xl font-bold focus:bg-white focus:ring-2 focus:ring-[#138808] outline-none" placeholder="E.g. BJP" /></div>
                          <div>
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Optical Identifier (Emoji)</label>
                            <input type="text" required value={newCandidate.symbol} onChange={e=>setNewCandidate({...newCandidate, symbol:e.target.value})} className="w-full border border-slate-300 bg-slate-50 p-3.5 rounded-xl font-bold text-2xl text-center focus:bg-white focus:ring-2 focus:ring-[#138808] outline-none" placeholder="🪷" />
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 block flex items-center gap-1"><ImageIcon size={14}/> Image Source</label>
                                <input type="url" required value={newCandidate.photo} onChange={e=>setNewCandidate({...newCandidate, photo:e.target.value})} className="w-full border border-slate-300 bg-slate-50 p-2.5 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#138808] outline-none text-sm" placeholder="URL Address" />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 block flex items-center gap-1"><ImageIcon size={14}/> Vector Flag</label>
                                <input type="url" value={newCandidate.backgroundUrl || ''} onChange={e=>setNewCandidate({...newCandidate, backgroundUrl:e.target.value})} className="w-full border border-slate-300 bg-slate-50 p-2.5 rounded-lg focus:bg-white focus:ring-2 focus:ring-[#138808] outline-none text-sm" placeholder="URL Address (Opt)" />
                            </div>
                          </div>
                          
                          <button type="submit" className={`w-full mt-4 text-white py-4 rounded-xl font-black shadow-lg uppercase tracking-widest flex justify-center gap-2 transition-colors ${editingCandidateId ? 'bg-[#000080] hover:bg-blue-900' : 'bg-[#138808] hover:bg-green-700'}`}>
                              {editingCandidateId ? <><RefreshCw size={18}/> Commit Modifications</> : <><Upload size={18}/> Inject Entity</>}
                          </button>
                      </form>
                  </div>
              </div>
          )}

          {activeTab === 'election' && (
            <div className="max-w-4xl mx-auto animate-fade-in-up">
                <div className="bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden text-center mb-8">
                    <div className="bg-[#000080] p-8 text-white"><Activity size={60} className="mx-auto mb-4 opacity-90"/><h3 className="text-3xl font-black uppercase tracking-widest">Network Protocol Override</h3><p className="font-bold text-blue-200 mt-2 tracking-wide uppercase">Direct Electoral Access Control</p></div>
                    <div className="p-6 md:p-10">
                        <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
                            <button onClick={() => updateConfig({electionStatus: 'upcoming'})} className={`px-6 md:px-10 py-4 md:py-6 rounded-xl font-black uppercase tracking-widest transition-all ${config?.electionStatus === 'upcoming' ? 'bg-[#FF9933] text-white shadow-lg scale-105' : 'bg-white border text-slate-400 hover:text-slate-600'}`}>1. Pre-Deployment</button>
                            <button onClick={() => updateConfig({electionStatus: 'active'})} className={`px-6 md:px-10 py-4 md:py-6 rounded-xl font-black uppercase tracking-widest transition-all ${config?.electionStatus === 'active' ? 'bg-[#138808] text-white shadow-lg scale-105' : 'bg-white border text-slate-400 hover:text-slate-600'}`}>2. Unseal Channels</button>
                            <button onClick={() => updateConfig({electionStatus: 'completed'})} className={`px-6 md:px-10 py-4 md:py-6 rounded-xl font-black uppercase tracking-widest transition-all ${config?.electionStatus === 'completed' ? 'bg-[#000080] text-white shadow-lg scale-105' : 'bg-white border text-slate-400 hover:text-slate-600'}`}>3. Seal & Audit</button>
                        </div>

                        {/* Timer Setup Component */}
                        <div className="mt-10 max-w-sm mx-auto border-t border-slate-300 pt-8">
                            <p className="text-xs font-black text-slate-500 uppercase mb-2 tracking-widest">Program Automated Deployment Timer</p>
                            <div className="flex gap-2">
                                <input type="datetime-local" value={adminTimerInput} onChange={e=>setAdminTimerInput(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#000080]" />
                                <button onClick={handleSetTimer} className="bg-[#000080] text-white px-6 font-black rounded-lg uppercase tracking-wider hover:bg-blue-900 transition-colors">Program</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-red-50 rounded-3xl shadow-sm border border-red-200 overflow-hidden p-6 md:p-8 mt-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                    <div>
                        <h3 className="text-xl font-black text-red-700 uppercase flex items-center justify-center md:justify-start gap-2"><ShieldAlert/> Critical Override: Purge Ledger</h3>
                        <p className="text-red-600 font-bold text-sm mt-1">Executing this command initiates a catastrophic purge of all secured cryptographic ballots. The network will reset.</p>
                    </div>
                    <button onClick={handleResetElection} className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest shadow-md transition-colors whitespace-nowrap w-full md:w-auto">
                       Execute Wipe Protocol
                    </button>
                </div>
            </div>
          )}

          {activeTab === 'results' && (
            <div className="max-w-5xl mx-auto animate-fade-in-up">
                
                {/* Live Voter Turnout Analytics Card */}
                <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-center">
                        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-1">Network Participation (Turnout)</h3>
                        <div className="flex items-end gap-4 mt-2">
                            <span className="text-5xl font-black text-[#000080]">{turnoutPercentage}%</span>
                            <span className="text-sm font-bold text-slate-400 mb-2">{totalVoted} / {totalApproved} Processed</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full mt-4 overflow-hidden border inset-shadow relative">
                             <div className="h-full bg-[#000080] transition-all duration-1000 ease-out" style={{width: `${turnoutPercentage}%`}}></div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-center items-center text-center">
                        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">Mandate Broadcasting Status</h3>
                        <button onClick={handlePublishResults} className={`w-full py-4 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-md transition-all ${config?.resultsPublished ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-[#138808] text-white'}`}>
                            {config?.resultsPublished ? <><EyeOff size={18}/> Cease Transmission</> : <><Eye size={18}/> Global Broadcast Initiate</>}
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-6 md:p-8 space-y-8">
                    <h3 className="text-2xl font-black text-[#000080] uppercase tracking-wide flex items-center gap-3 border-b pb-4"><BarChart3 size={28}/> Decentralized Ledger Analytics</h3>
                    {candidates.length === 0 ? <p className="text-center font-bold text-slate-400 py-10">No entity metrics available.</p> : 
                     calculateResults().map((c, index) => {
                         const total = Object.values(config?.votes || {}).reduce((a,b)=>a+b,0) || 1;
                         const percentage = ((c.votes/total)*100).toFixed(1);
                         return (
                            <div key={c.id} className="relative">
                                <div className="flex justify-between items-end mb-3">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-slate-100 overflow-hidden bg-slate-200 shrink-0"><img src={c.photo} className="w-full h-full object-cover" onError={(e)=>e.target.style.display='none'}/></div>
                                        <div><p className="font-black text-lg sm:text-xl text-slate-800 uppercase flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">{c.party} {index === 0 && c.votes > 0 && <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded uppercase tracking-widest border border-yellow-300 w-max">Statistical Superiority</span>}</p><p className="text-xs font-bold text-slate-500 uppercase">{c.name}</p></div>
                                    </div>
                                    <div className="text-right"><p className="text-3xl sm:text-4xl font-black text-[#000080] tracking-tighter">{c.votes}</p></div>
                                </div>
                                <div className="w-full h-6 bg-slate-100 rounded-full border border-slate-200 shadow-inner relative">
                                    <div className="h-full bg-gradient-to-r from-[#FF9933] via-orange-400 to-[#138808] rounded-full transition-all duration-1000 ease-out flex items-center justify-end px-3" style={{width: `${percentage}%`}}><span className="text-[10px] font-black text-white drop-shadow-md">{percentage}%</span></div>
                                </div>
                            </div>
                         )
                     })}
                </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="animate-fade-in-up">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                 <div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 uppercase flex items-center gap-2"><ShieldAlert size={28} className="text-[#000080]"/> Cryptographic Forensic Trail</h3>
                 </div>
                 <button onClick={() => {if(window.confirm("Initiate irreversible purge of forensic logs?")) clearLogs();}} className="bg-red-50 text-red-600 font-bold px-4 py-2 rounded-lg border border-red-200 hover:bg-red-100 flex items-center justify-center gap-2 w-full sm:w-auto"><Trash2 size={16}/> Purge Trace</button>
              </div>
              <div className="bg-slate-900 rounded-3xl shadow-xl border-4 border-slate-800 font-mono text-sm overflow-hidden overflow-x-auto">
                  <div className="p-5 border-b-2 border-slate-700 flex bg-slate-950 text-slate-400 font-black tracking-widest uppercase min-w-[600px]"><div className="w-1/4">Chronological Index (IST)</div><div className="w-1/4">System Operation</div><div className="w-1/2">Event Signature</div></div>
                  <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar-dark min-w-[600px]">
                      {logs.length === 0 ? <div className="p-10 text-center text-slate-600 font-bold uppercase tracking-widest">Network operating within standard parameters. No forensic anomalies.</div> : 
                       logs.map((log, i) => (
                          <div key={i} className="flex p-4 border-b border-slate-800/50 hover:bg-slate-800 transition-colors">
                              <div className="w-1/4 text-blue-400 font-bold">{new Date(log.timestamp).toLocaleString()}</div>
                              <div className="w-1/4 font-black text-yellow-400 uppercase tracking-wide">{log.action}</div>
                              <div className="w-1/2 text-green-400">{log.user}</div>
                          </div>
                      ))}
                  </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// =========================================================================
// MAIN ROUTER (ENTRY POINT)
// =========================================================================
export default function App() {
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan { 0% { transform: translateY(0); } 50% { transform: translateY(220px); } 100% { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-slow { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
        .animate-pulse-slow { animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar-dark::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar-dark::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }

        @media print {
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible !important; }
            .print-area { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; margin: 0; padding: 0; }
            .no-print { display: none !important; }
            @page { margin: 0; }
        }
      `}} />
      <VotingProvider>
        <ToastManager />
        <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/dashboard" element={<UserDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
        </BrowserRouter>
      </VotingProvider>
    </>
  );
}