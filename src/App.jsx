import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { createClient } from '@supabase/supabase-js';
import { Plus, Trash2, FileText, Grid3x3, Download, Printer, Save, RotateCcw, Users, DollarSign, Clock, BookUser, TrendingUp, AlertCircle, Repeat, Search, X, Check, Phone, MapPin, Edit2, ChevronRight, FileSpreadsheet, CalendarDays, Truck, Home, Building2, Navigation, Receipt, Settings, MessageCircle, Wallet, Tag, CreditCard, Cloud, CloudOff, RefreshCw } from 'lucide-react';

// ===== SUPABASE CLOUD CONNECTION =====
const SUPABASE_URL = 'https://atokkkspcampdoivrxwg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0b2tra3NwY2FtcGRvaXZyeHdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTY3MTUsImV4cCI6MjA5MzEzMjcxNX0.caS-qlXLJp9KhuikrooM23vEiIVSZ3taheZ3rONNU1U';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CLEANERS = ['Leah', 'Eva', 'Zainab', 'Roselyn', 'Coline', 'Angel','Sara','Souma', 'Razelle'];

// Payroll roster: list of employees who get a monthly salary. Includes cleaners AND non-cleaners
// (like supervisors, drivers, admins). Each has a default salary that the "Generate All Salaries"
// button uses to fill in the Payroll tab in one click. Edit the amounts here to change defaults.
// Order = display order in the payroll table.
const PAYROLL_ROSTER = [
  { name: 'Leah',    defaultSalary: 1800, role: 'Cleaner' },
  { name: 'Razelle', defaultSalary: 1800, role: 'Cleaner' },
  { name: 'Malek',   defaultSalary: 3350, role: 'Supervisor' }, // Not a cleaner — payroll only
  { name: 'Roselyn', defaultSalary: 1800, role: 'Cleaner' },
  { name: 'Eva',     defaultSalary: 1800, role: 'Cleaner' },
  { name: 'Angel',   defaultSalary: 1800, role: 'Cleaner' },
  { name: 'Zainab',  defaultSalary: 1800, role: 'Cleaner' },
  { name: 'Coline',  defaultSalary: 1800, role: 'Cleaner' },
];
const PICKUP_TYPES = ['HOME', 'OFFICE'];
const EXPENSE_CATEGORIES = ['Salaries', 'Transport', 'Materials', 'Marketing', 'Rent', 'Utilities', 'Maintenance/Repairs', 'PPE & Uniforms', 'Staff Meals/Allowances', 'Office Supplies', 'Government Fees', 'Bank Charges', 'Software/Subscriptions', 'Fuel', 'Vehicle Service', 'Miscellaneous'];
const EXPENSE_PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Credit Card', 'Cheque', 'Online Gateway'];
// Cleaner colors for map pins (distinct, easy to differentiate)
const CLEANER_COLORS = {
  'Leah': '#E63946',     // Red
  'Eva': '#1D4ED8',      // Blue
  'Zainab': '#10B981',   // Emerald
  'Roselyn': '#F59E0B',  // Amber
  'Coline': '#8B5CF6',   // Purple
  'Angel': '#EC4899',    // Pink
  'Razelle': '#0F4C3A'   // Dark green
};
const PAYMENT_TYPES = ['ONLINE', 'CASH'];
const PAYMENT_STATUS = ['PAID', 'PENDING'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parseHours = (timing) => {
  if (!timing) return 0;
  const cleaned = timing.replace(/\s/g, '').toLowerCase();
  const match = cleaned.match(/(\d+)(?::(\d+))?-(\d+)(?::(\d+))?/);
  if (!match) return 0;
  let startH = parseInt(match[1]);
  const startM = parseInt(match[2] || 0);
  let endH = parseInt(match[3]);
  const endM = parseInt(match[4] || 0);
  if (endH < startH) endH += 12;
  return Math.max(0, (endH + endM / 60) - (startH + startM / 60));
};

const emptyBooking = () => ({
  id: Date.now() + Math.random(),
  cleaner: 'Leah', timing: '', clientId: null, clientName: '', location: '', phone: '',
  withMaterials: false, pricePerHour: 25, paymentType: 'ONLINE', paymentStatus: 'PENDING', notes: '',
  pickupType: 'OFFICE', // HOME or OFFICE - where driver picks cleaner up before this job
  lat: null, lng: null  // location coordinates (auto-geocoded or manually set)
});

const emptyClient = () => ({
  id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
  name: '', phone: '', address: '', defaultRate: 25, defaultMaterials: false, notes: '',
  lat: null, lng: null
});

const emptyContract = () => ({
  id: 'k_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
  clientId: null, clientName: '', cleaner: 'Leah', daysOfWeek: [], timing: '',
  pricePerHour: 25, withMaterials: false, paymentType: 'ONLINE', active: true,
  startDate: new Date().toISOString().split('T')[0]
});

export default function CleaningApp() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState([emptyBooking()]);
  const [view, setView] = useState('input');
  const [savedDays, setSavedDays] = useState({});
  const [clients, setClients] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [clientPickerFor, setClientPickerFor] = useState(null);
  const [bookingPinFor, setBookingPinFor] = useState(null);
  const [cleanerHomes, setCleanerHomes] = useState({}); // { Leah: { address, lat, lng }, ... }
  const [officeAddress, setOfficeAddress] = useState({ address: 'Office, Abu Dhabi', lat: 24.4539, lng: 54.3773 });
  const [expenses, setExpenses] = useState([]);
  // payroll: { [monthKey]: { [cleanerName]: { salary, deductions: [{amount, reason, date}], bonuses: [{amount, reason, date}], attendance: { [dateISO]: 'present' | 'absent' | 'half' }, workingHours: number, notes } } }
  // monthKey format: 'YYYY-MM' (e.g. '2026-04')
  const [payroll, setPayroll] = useState({});
  // clientCredits: { [clientName]: { balance: number, history: [{date, amount, note, type: 'credit'|'debit'}] } }
  const [clientCredits, setClientCredits] = useState({});
  const [cloudStatus, setCloudStatus] = useState('connecting'); // 'connecting', 'synced', 'syncing', 'offline'
  const [lastSync, setLastSync] = useState(null);
  const [companyInfo, setCompanyInfo] = useState({
    name: 'AR Cleaning Services',
    address: 'Office 92, M-floor Al Jazeera Bldg, Abu Dhabi City, UAE',
    phone: '050 332 7215',
    email: 'arhomeservices.ae@gmail.com',
    trn: '',
    bankName: 'AR Cleaning and Maintenance Services',
    bankBranch: 'ADCB Commercial Bank, Abu Dhabi',
    accountNo: '13024902820001',
    iban: 'AE160030013024902820001',
    swift: 'ADCBAEAA',
    bankNote: 'Bank transfer: Please send us proof of transfer once it is done.\nCash payment: Kindly give to the assigned cleaner.',
    invoiceCounter: 3003,
    logoDataUrl: ''
  });

  // ===== LOAD FROM CLOUD (with localStorage fallback) =====
  useEffect(() => {
    const loadFromCloud = async () => {
      setCloudStatus('connecting');

      // First, load from localStorage immediately so UI is not empty
      try {
        const daysRaw = localStorage.getItem('sparkle_all_days');
        if (daysRaw) {
          const d = JSON.parse(daysRaw);
          setSavedDays(d);
          const today = new Date().toISOString().split('T')[0];
          if (d[today]) setBookings(d[today].bookings);
        }
        const clientsRaw = localStorage.getItem('sparkle_clients');
        if (clientsRaw) setClients(JSON.parse(clientsRaw));
        const contractsRaw = localStorage.getItem('sparkle_contracts');
        if (contractsRaw) setContracts(JSON.parse(contractsRaw));
        const homesRaw = localStorage.getItem('sparkle_cleaner_homes');
        if (homesRaw) setCleanerHomes(JSON.parse(homesRaw));
        const officeRaw = localStorage.getItem('sparkle_office');
        if (officeRaw) setOfficeAddress(JSON.parse(officeRaw));
        const companyRaw = localStorage.getItem('sparkle_company');
        if (companyRaw) setCompanyInfo(prev => ({ ...prev, ...JSON.parse(companyRaw) }));
        const expensesRaw = localStorage.getItem('sparkle_expenses');
        if (expensesRaw) setExpenses(JSON.parse(expensesRaw));
        const payrollRaw = localStorage.getItem('sparkle_payroll');
        if (payrollRaw) setPayroll(JSON.parse(payrollRaw));
        const creditsRaw = localStorage.getItem('sparkle_client_credits');
        if (creditsRaw) setClientCredits(JSON.parse(creditsRaw));
      } catch (e) { console.error('Local load error:', e); }

      // Then try to fetch from cloud and overwrite local data with cloud data
      try {
        // Days
        const { data: daysData, error: daysErr } = await supabase.from('days').select('*');
        if (!daysErr && daysData) {
          const daysMap = {};
          daysData.forEach(d => {
            daysMap[d.date] = { bookings: d.bookings, savedAt: d.saved_at };
          });
          setSavedDays(daysMap);
          try { localStorage.setItem('sparkle_all_days', JSON.stringify(daysMap)); } catch (e) {}
          const today = new Date().toISOString().split('T')[0];
          if (daysMap[today]) setBookings(daysMap[today].bookings);
        }

        // Clients
        const { data: clientsData, error: clientsErr } = await supabase.from('clients').select('*');
        if (!clientsErr && clientsData) {
          const cs = clientsData.map(c => ({
            id: c.id, name: c.name, phone: c.phone || '', address: c.address || '',
            defaultRate: c.default_rate || 25, defaultMaterials: c.default_materials || false,
            notes: c.notes || '', lat: c.lat, lng: c.lng
          }));
          setClients(cs);
          try { localStorage.setItem('sparkle_clients', JSON.stringify(cs)); } catch (e) {}
        }

        // Contracts
        const { data: contractsData, error: contractsErr } = await supabase.from('contracts').select('*');
        if (!contractsErr && contractsData) {
          const cs = contractsData.map(c => ({
            id: c.id, clientId: c.client_id, clientName: c.client_name, cleaner: c.cleaner,
            daysOfWeek: c.days_of_week || [], timing: c.timing || '',
            pricePerHour: c.price_per_hour || 25, withMaterials: c.with_materials || false,
            paymentType: c.payment_type || 'ONLINE', active: c.active !== false,
            startDate: c.start_date || ''
          }));
          setContracts(cs);
          try { localStorage.setItem('sparkle_contracts', JSON.stringify(cs)); } catch (e) {}
        }

        // Cleaner homes
        const { data: homesData, error: homesErr } = await supabase.from('cleaner_homes').select('*');
        if (!homesErr && homesData) {
          const homes = {};
          homesData.forEach(h => {
            homes[h.cleaner] = { address: h.address || '', lat: h.lat, lng: h.lng };
          });
          setCleanerHomes(homes);
          try { localStorage.setItem('sparkle_cleaner_homes', JSON.stringify(homes)); } catch (e) {}
        }

        // Office
        const { data: officeData, error: officeErr } = await supabase.from('office').select('*').eq('id', 1).single();
        if (!officeErr && officeData) {
          const office = { address: officeData.address || 'Office, Abu Dhabi', lat: officeData.lat || 24.4539, lng: officeData.lng || 54.3773 };
          setOfficeAddress(office);
          try { localStorage.setItem('sparkle_office', JSON.stringify(office)); } catch (e) {}
        }

        // Company
        const { data: companyData, error: companyErr } = await supabase.from('company').select('*').eq('id', 1).single();
        if (!companyErr && companyData && companyData.data) {
          setCompanyInfo(prev => ({ ...prev, ...companyData.data }));
          try { localStorage.setItem('sparkle_company', JSON.stringify(companyData.data)); } catch (e) {}
        }

        // Expenses
        const { data: expensesData, error: expensesErr } = await supabase.from('expenses').select('*');
        if (!expensesErr && expensesData) {
          const es = expensesData.map(e => ({
            id: e.id, date: e.date, category: e.category, amount: e.amount,
            paymentMethod: e.payment_method, description: e.description || '',
            vendor: e.vendor || '', receipt: e.receipt || '', notes: e.notes || ''
          }));
          setExpenses(es);
          try { localStorage.setItem('sparkle_expenses', JSON.stringify(es)); } catch (e) {}
        }

        setCloudStatus('synced');
        setLastSync(new Date());
      } catch (e) {
        console.error('Cloud load error:', e);
        setCloudStatus('offline');
      }
    };
    loadFromCloud();
  }, []);

  useEffect(() => {
    if (savedDays[date]) setBookings(savedDays[date].bookings);
  }, [date]);

  // ===== HELPER FUNCTIONS =====
  const showStatus = (m) => { setStatusMsg(m); setTimeout(() => setStatusMsg(''), 2500); };

  const updateBooking = (id, field, value) => setBookings(bookings.map(b => b.id === id ? { ...b, [field]: value } : b));
  const addBooking = () => setBookings([...bookings, emptyBooking()]);
  const removeBooking = (id) => setBookings(bookings.filter(b => b.id !== id));

  const applyClientToBooking = (bookingId, client) => {
    setBookings(bookings.map(b => b.id === bookingId ? {
      ...b, clientId: client.id, clientName: client.name, location: client.address,
      phone: client.phone, pricePerHour: client.defaultRate, withMaterials: client.defaultMaterials,
      lat: client.lat || null, lng: client.lng || null,
    } : b));
    setClientPickerFor(null);
  };

  const saveDay = async () => {
    const newSaved = { ...savedDays, [date]: { bookings, savedAt: new Date().toISOString() } };
    setSavedDays(newSaved);
    try { localStorage.setItem('sparkle_all_days', JSON.stringify(newSaved)); } catch (e) {}
    setCloudStatus('syncing');
    try {
      const { error } = await supabase.from('days').upsert({ date, bookings, saved_at: new Date().toISOString() });
      if (error) throw error;
      setCloudStatus('synced');
      setLastSync(new Date());
      showStatus('✓ Day saved & synced to cloud');
    } catch (e) {
      setCloudStatus('offline');
      showStatus('✓ Day saved locally (cloud sync failed)');
      console.error('Cloud save error:', e);
    }
  };

  const clearDay = () => { if (confirm('Clear bookings for this day?')) setBookings([emptyBooking()]); };

  const loadDate = (d) => {
    setDate(d);
    if (savedDays[d]) setBookings(savedDays[d].bookings);
    else setBookings([emptyBooking()]);
  };

  const saveClients = async (next) => {
    setClients(next);
    try { localStorage.setItem('sparkle_clients', JSON.stringify(next)); } catch (e) {}
    setCloudStatus('syncing');
    try {
      // Get current cloud client IDs to detect deletions
      const { data: cloudClients } = await supabase.from('clients').select('id');
      const cloudIds = new Set((cloudClients || []).map(c => c.id));
      const localIds = new Set(next.map(c => c.id));
      const toDelete = [...cloudIds].filter(id => !localIds.has(id));
      if (toDelete.length > 0) {
        await supabase.from('clients').delete().in('id', toDelete);
      }
      // Upsert all current clients
      if (next.length > 0) {
        const rows = next.map(c => ({
          id: c.id, name: c.name, phone: c.phone || '', address: c.address || '',
          default_rate: c.defaultRate || 25, default_materials: c.defaultMaterials || false,
          notes: c.notes || '', lat: c.lat || null, lng: c.lng || null
        }));
        const { error } = await supabase.from('clients').upsert(rows);
        if (error) throw error;
      }
      setCloudStatus('synced');
      setLastSync(new Date());
    } catch (e) {
      setCloudStatus('offline');
      console.error('Cloud sync error (clients):', e);
    }
  };

  const saveContracts = async (next) => {
    setContracts(next);
    try { localStorage.setItem('sparkle_contracts', JSON.stringify(next)); } catch (e) {}
    setCloudStatus('syncing');
    try {
      const { data: cloudContracts } = await supabase.from('contracts').select('id');
      const cloudIds = new Set((cloudContracts || []).map(c => c.id));
      const localIds = new Set(next.map(c => c.id));
      const toDelete = [...cloudIds].filter(id => !localIds.has(id));
      if (toDelete.length > 0) {
        await supabase.from('contracts').delete().in('id', toDelete);
      }
      if (next.length > 0) {
        const rows = next.map(c => ({
          id: c.id, client_id: c.clientId, client_name: c.clientName, cleaner: c.cleaner,
          days_of_week: c.daysOfWeek || [], timing: c.timing || '',
          price_per_hour: c.pricePerHour || 25, with_materials: c.withMaterials || false,
          payment_type: c.paymentType || 'ONLINE', active: c.active !== false,
          start_date: c.startDate || null
        }));
        const { error } = await supabase.from('contracts').upsert(rows);
        if (error) throw error;
      }
      setCloudStatus('synced');
      setLastSync(new Date());
    } catch (e) {
      setCloudStatus('offline');
      console.error('Cloud sync error (contracts):', e);
    }
  };

  const saveCleanerHomes = async (next) => {
    setCleanerHomes(next);
    try { localStorage.setItem('sparkle_cleaner_homes', JSON.stringify(next)); } catch (e) {}
    setCloudStatus('syncing');
    try {
      const rows = Object.entries(next).filter(([_, h]) => h && h.address).map(([cleaner, h]) => ({
        cleaner, address: h.address || '', lat: h.lat || null, lng: h.lng || null,
        updated_at: new Date().toISOString()
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from('cleaner_homes').upsert(rows);
        if (error) throw error;
      }
      setCloudStatus('synced');
      setLastSync(new Date());
    } catch (e) {
      setCloudStatus('offline');
      console.error('Cloud sync error (cleaner_homes):', e);
    }
  };

  const saveOfficeAddress = async (next) => {
    setOfficeAddress(next);
    try { localStorage.setItem('sparkle_office', JSON.stringify(next)); } catch (e) {}
    setCloudStatus('syncing');
    try {
      const { error } = await supabase.from('office').upsert({
        id: 1, address: next.address || '', lat: next.lat || null, lng: next.lng || null,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      setCloudStatus('synced');
      setLastSync(new Date());
    } catch (e) {
      setCloudStatus('offline');
      console.error('Cloud sync error (office):', e);
    }
  };

  const saveCompanyInfo = async (next) => {
    setCompanyInfo(next);
    try { localStorage.setItem('sparkle_company', JSON.stringify(next)); } catch (e) {}
    setCloudStatus('syncing');
    try {
      const { error } = await supabase.from('company').upsert({
        id: 1, data: next, updated_at: new Date().toISOString()
      });
      if (error) throw error;
      setCloudStatus('synced');
      setLastSync(new Date());
    } catch (e) {
      setCloudStatus('offline');
      console.error('Cloud sync error (company):', e);
    }
  };

  const saveExpenses = async (next) => {
    setExpenses(next);
    try { localStorage.setItem('sparkle_expenses', JSON.stringify(next)); } catch (e) {}
    setCloudStatus('syncing');
    try {
      const { data: cloudExpenses } = await supabase.from('expenses').select('id');
      const cloudIds = new Set((cloudExpenses || []).map(e => e.id));
      const localIds = new Set(next.map(e => e.id));
      const toDelete = [...cloudIds].filter(id => !localIds.has(id));
      if (toDelete.length > 0) {
        await supabase.from('expenses').delete().in('id', toDelete);
      }
      if (next.length > 0) {
        const rows = next.map(e => ({
          id: e.id, date: e.date, category: e.category, amount: parseFloat(e.amount || 0),
          payment_method: e.paymentMethod, description: e.description || '',
          vendor: e.vendor || '', receipt: e.receipt || '', notes: e.notes || ''
        }));
        const { error } = await supabase.from('expenses').upsert(rows);
        if (error) throw error;
      }
      setCloudStatus('synced');
      setLastSync(new Date());
    } catch (e) {
      setCloudStatus('offline');
      console.error('Cloud sync error (expenses):', e);
    }
  };

  // Payroll is saved only to localStorage (no cloud table yet — can be added later without breaking anything)
  const savePayroll = (next) => {
    setPayroll(next);
    try { localStorage.setItem('sparkle_payroll', JSON.stringify(next)); } catch (e) {}
  };

  // Client credits are saved only to localStorage (no cloud table yet)
  const saveClientCredits = (next) => {
    setClientCredits(next);
    try { localStorage.setItem('sparkle_client_credits', JSON.stringify(next)); } catch (e) {}
  };

  const generateFromContracts = () => {
    const dayOfWeek = new Date(date).getDay();
    const matching = contracts.filter(c => c.active && c.daysOfWeek.includes(dayOfWeek));
    if (matching.length === 0) { showStatus('No contracts for this day'); return; }
    const existingClientIds = new Set(bookings.map(b => b.clientId).filter(Boolean));
    const newBookings = matching.filter(c => !existingClientIds.has(c.clientId)).map(c => {
      const client = clients.find(cl => cl.id === c.clientId);
      return {
        ...emptyBooking(), cleaner: c.cleaner, timing: c.timing, clientId: c.clientId,
        clientName: c.clientName, location: client?.address || '', phone: client?.phone || '',
        pricePerHour: c.pricePerHour, withMaterials: c.withMaterials, paymentType: c.paymentType,
      };
    });
    if (newBookings.length === 0) { showStatus('Already added'); return; }
    const cleanedExisting = bookings.filter(b => b.clientName || b.location);
    setBookings([...cleanedExisting, ...newBookings]);
    showStatus(`✓ Added ${newBookings.length} contract booking${newBookings.length > 1 ? 's' : ''}`);
  };

  // ===== DERIVED STATE =====
  const bookingsWithCalc = bookings.filter(b => b.clientName || b.location).map(b => {
    const hours = parseHours(b.timing);
    return { ...b, hours, total: hours * parseFloat(b.pricePerHour || 0) };
  });

  const byCleaner = {};
  CLEANERS.forEach(c => byCleaner[c] = []);
  bookingsWithCalc.forEach(b => { if (byCleaner[b.cleaner]) byCleaner[b.cleaner].push(b); });

  const totalRevenue = bookingsWithCalc.reduce((s, b) => s + b.total, 0);
  const totalHours = bookingsWithCalc.reduce((s, b) => s + b.hours, 0);
  const cashTotal = bookingsWithCalc.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + b.total, 0);
  const onlineTotal = bookingsWithCalc.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + b.total, 0);
  const activeCleaners = CLEANERS.filter(c => byCleaner[c].length > 0).length;

  const allBookingsWithDate = [];
  Object.entries(savedDays).forEach(([d, data]) => {
    data.bookings.forEach(b => {
      if (b.clientName || b.location) {
        const hrs = parseHours(b.timing);
        allBookingsWithDate.push({ ...b, date: d, hours: hrs, total: hrs * parseFloat(b.pricePerHour || 0) });
      }
    });
  });
  if (!savedDays[date]) bookingsWithCalc.forEach(b => allBookingsWithDate.push({ ...b, date }));

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const formatDateShort = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const exportCSV = () => {
    const headers = ['DATE', 'CLEANER', 'TIMINGS', 'CLIENT', 'LOCATION', 'MATERIALS', 'HOURS', 'RATE', 'TOTAL', 'PAY TYPE', 'STATUS'];
    const rows = bookingsWithCalc.map(b => [
      new Date(date).getDate(), b.cleaner, b.timing, b.clientName, b.location,
      b.withMaterials ? 'Yes' : 'No', b.hours, b.pricePerHour, b.total.toFixed(2), b.paymentType, b.paymentStatus
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `report_${date}.csv`; a.click();
  };

  // ===== EXCEL EXPORT FUNCTIONS (matching deployment grid style) =====
  // Color palette matching the app:
  //   Green header: #0F4C3A
  //   Cream cleaner header: #F5EFD9
  //   Mint green for materials: #D4E8DC
  //   Red AED prices: #B8472A
  //   Cream alt row: #FAF8F3

  const RGB = {
    green: 'FF0F4C3A',
    cream: 'FFF5EFD9',
    mint: 'FFD4E8DC',
    red: 'FFB8472A',
    altRow: 'FFFAF8F3',
    white: 'FFFFFFFF',
    ink: 'FF1A1A1A',
    border: 'FFD4CFC0',
    paidBg: 'FFD4E8DC',
    pendingBg: 'FFFEE2E2',
    pendingText: 'FFB8472A',
    paidText: 'FF0F4C3A',
    yellowAccent: 'FFFFF59D'
  };

  const borderAll = (color = RGB.ink, style = 'thin') => ({
    top: { style, color: { rgb: color } },
    bottom: { style, color: { rgb: color } },
    left: { style, color: { rgb: color } },
    right: { style, color: { rgb: color } }
  });

  // Title banner — green background, white bold text (matches deployment grid header)
  const STYLE_TITLE = {
    font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: RGB.white } },
    fill: { patternType: 'solid', fgColor: { rgb: RGB.green } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll(RGB.ink, 'medium')
  };

  // Subtitle — green background, italic white
  const STYLE_SUBTITLE = {
    font: { name: 'Calibri', sz: 11, italic: true, color: { rgb: RGB.white } },
    fill: { patternType: 'solid', fgColor: { rgb: RGB.green } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll(RGB.ink, 'medium')
  };

  // Header row — cream background with bold black text (like cleaner names in your grid)
  const STYLE_HEADER = {
    font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: RGB.ink } },
    fill: { patternType: 'solid', fgColor: { rgb: RGB.cream } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll(RGB.ink, 'thin')
  };

  // Regular cell — white background
  const STYLE_CELL = {
    font: { name: 'Calibri', sz: 11, color: { rgb: RGB.ink } },
    fill: { patternType: 'solid', fgColor: { rgb: RGB.white } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll(RGB.ink, 'thin')
  };

  // Alt row — cream
  const STYLE_CELL_ALT = {
    font: { name: 'Calibri', sz: 11, color: { rgb: RGB.ink } },
    fill: { patternType: 'solid', fgColor: { rgb: RGB.altRow } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll(RGB.ink, 'thin')
  };

  // Mint green — for "with materials" rows (matches grid)
  const STYLE_CELL_MATERIALS = {
    font: { name: 'Calibri', sz: 11, color: { rgb: RGB.ink } },
    fill: { patternType: 'solid', fgColor: { rgb: RGB.mint } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderAll(RGB.ink, 'thin')
  };

  // Total row — green background, white bold (like title banner)
  const STYLE_TOTAL = {
    font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: RGB.white } },
    fill: { patternType: 'solid', fgColor: { rgb: RGB.green } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll(RGB.ink, 'medium')
  };

  // Red AED prices — bold red on white (matches grid)
  const STYLE_PRICE = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: RGB.red } },
    fill: { patternType: 'solid', fgColor: { rgb: RGB.white } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll(RGB.ink, 'thin')
  };
  const STYLE_PRICE_MAT = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: RGB.red } },
    fill: { patternType: 'solid', fgColor: { rgb: RGB.mint } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll(RGB.ink, 'thin')
  };
  const STYLE_PRICE_ALT = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: RGB.red } },
    fill: { patternType: 'solid', fgColor: { rgb: RGB.altRow } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll(RGB.ink, 'thin')
  };

  // Status badges
  const STYLE_PAID = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: RGB.paidText } },
    fill: { patternType: 'solid', fgColor: { rgb: RGB.paidBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll(RGB.ink, 'thin')
  };
  const STYLE_PENDING = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: RGB.pendingText } },
    fill: { patternType: 'solid', fgColor: { rgb: RGB.pendingBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll(RGB.ink, 'thin')
  };

  // Builder helper — produces a worksheet that visually matches the app's design
  const buildStyledSheet = (title, subtitle, headers, rows, colWidths, opts = {}) => {
    const { totalRow, statusCol, materialsCol, priceCol, materialsHighlight = true } = opts;
    const ws = {};
    const cols = headers.length;

    // Row 0: Title (merged)
    for (let c = 0; c < cols; c++) {
      ws[XLSX.utils.encode_cell({ r: 0, c })] = { v: c === 0 ? title : '', t: 's', s: STYLE_TITLE };
    }
    // Row 1: Subtitle (merged)
    for (let c = 0; c < cols; c++) {
      ws[XLSX.utils.encode_cell({ r: 1, c })] = { v: c === 0 ? subtitle : '', t: 's', s: STYLE_SUBTITLE };
    }
    // Row 2: Headers (cream cells like cleaner names in deployment grid)
    headers.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({ r: 2, c })] = { v: h, t: 's', s: STYLE_HEADER };
    });

    // Data rows: row 3+
    rows.forEach((row, rIdx) => {
      const r = rIdx + 3;
      const isTotalRow = totalRow && rIdx === rows.length - 1;
      // Detect if row has materials = Yes
      const hasMaterials = materialsHighlight && materialsCol !== undefined && row[materialsCol] === 'Yes';
      const alt = rIdx % 2 === 1;

      row.forEach((cell, c) => {
        let style;
        if (isTotalRow) {
          style = STYLE_TOTAL;
        } else if (statusCol !== undefined && c === statusCol) {
          style = cell === 'PAID' ? STYLE_PAID : STYLE_PENDING;
        } else if (priceCol !== undefined && c === priceCol) {
          // Red bold price cell — background depends on materials/alt
          if (hasMaterials) style = STYLE_PRICE_MAT;
          else if (alt) style = STYLE_PRICE_ALT;
          else style = STYLE_PRICE;
        } else if (hasMaterials) {
          style = STYLE_CELL_MATERIALS;
        } else if (alt) {
          style = STYLE_CELL_ALT;
        } else {
          style = STYLE_CELL;
        }
        const isNumber = typeof cell === 'number';
        ws[XLSX.utils.encode_cell({ r, c })] = { v: cell, t: isNumber ? 'n' : 's', s: style };
      });
    });

    const lastRow = rows.length + 2;
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: cols - 1 } });
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: cols - 1 } }
    ];
    ws['!cols'] = colWidths.map(w => ({ wch: w }));
    // Row heights: title big, subtitle medium, header tall, data normal
    const rowHeights = [{ hpt: 32 }, { hpt: 20 }, { hpt: 28 }];
    for (let i = 0; i < rows.length; i++) rowHeights.push({ hpt: 22 });
    ws['!rows'] = rowHeights;
    return ws;
  };

  const formatLongDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const exportDailyReportExcel = () => {
    const headers = ['DATE', 'CLEANER', 'TIMINGS', 'CLIENT', 'LOCATION', 'PHONE', 'MAT.', 'HRS', 'RATE', 'TOTAL (AED)', 'PAY', 'STATUS'];
    const dayNum = new Date(date).getDate();
    const rows = bookingsWithCalc.map(b => [
      dayNum, b.cleaner, b.timing, b.clientName, b.location, b.phone || '',
      b.withMaterials ? 'Yes' : 'No', Number(b.hours), Number(b.pricePerHour),
      Number(b.total.toFixed(2)), b.paymentType, b.paymentStatus || 'PENDING'
    ]);
    rows.push(['', '', '', '', '', '', 'TOTAL', Number(totalHours.toFixed(1)), '', Number(totalRevenue.toFixed(2)), '', '']);
    const widths = [6, 12, 12, 22, 32, 16, 8, 8, 8, 14, 10, 12];
    const ws = buildStyledSheet('DEPLOYMENT — DAILY REPORT', formatLongDate(date), headers, rows, widths, {
      totalRow: true, statusCol: 11, materialsCol: 6, priceCol: 9
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Report');
    XLSX.writeFile(wb, `daily_report_${date}.xlsx`);
    showStatus('✓ Excel downloaded');
  };

  const exportClientsExcel = () => {
    const headers = ['NAME', 'PHONE', 'ADDRESS', 'RATE/HR', 'MAT.', 'VISITS', 'TOTAL REVENUE (AED)', 'NOTES'];
    const rows = clients.map(c => {
      const visits = allBookingsWithDate.filter(b => b.clientId === c.id);
      return [
        c.name, c.phone || '', c.address || '', Number(c.defaultRate),
        c.defaultMaterials ? 'Yes' : 'No', visits.length,
        Number(visits.reduce((s, b) => s + (b.total || 0), 0).toFixed(2)), c.notes || ''
      ];
    });
    const widths = [22, 18, 38, 10, 8, 10, 18, 28];
    const ws = buildStyledSheet('SPARKLE OPERATIONS — CLIENT DATABASE', `${clients.length} clients · Generated ${new Date().toLocaleDateString()}`, headers, rows, widths, {
      materialsCol: 4, priceCol: 6
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, `clients_${new Date().toISOString().split('T')[0]}.xlsx`);
    showStatus('✓ Excel downloaded');
  };

  const exportContractsExcel = () => {
    const headers = ['CLIENT', 'CLEANER', 'DAYS', 'TIMING', 'RATE/HR', 'MAT.', 'PAYMENT', 'STATUS'];
    const rows = contracts.map(c => [
      c.clientName, c.cleaner, c.daysOfWeek.map(d => DAYS[d]).join(', '),
      c.timing, Number(c.pricePerHour), c.withMaterials ? 'Yes' : 'No',
      c.paymentType, c.active ? 'Active' : 'Paused'
    ]);
    const widths = [22, 12, 26, 14, 10, 8, 12, 10];
    const ws = buildStyledSheet('SPARKLE OPERATIONS — RECURRING CONTRACTS', `${contracts.filter(c => c.active).length} active contracts`, headers, rows, widths, {
      materialsCol: 5, priceCol: 4
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contracts');
    XLSX.writeFile(wb, `contracts_${new Date().toISOString().split('T')[0]}.xlsx`);
    showStatus('✓ Excel downloaded');
  };

  const exportEarningsExcel = (period, filtered) => {
    const periodLabel = period === 'week' ? 'Last 7 days' : period === 'month' ? 'This month' : 'All time';
    const sumHeaders = ['CLEANER', 'JOBS', 'HOURS', 'CLIENTS', 'CASH (AED)', 'ONLINE (AED)', 'TOTAL (AED)'];
    const sumRows = CLEANERS.map(name => {
      const jobs = filtered.filter(b => b.cleaner === name);
      return [
        name, jobs.length,
        Number(jobs.reduce((s, b) => s + (b.hours || 0), 0).toFixed(1)),
        new Set(jobs.map(b => b.clientName)).size,
        Number(jobs.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + (b.total || 0), 0).toFixed(2)),
        Number(jobs.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + (b.total || 0), 0).toFixed(2)),
        Number(jobs.reduce((s, b) => s + (b.total || 0), 0).toFixed(2))
      ];
    });
    sumRows.push([
      'GRAND TOTAL', filtered.length,
      Number(filtered.reduce((s, b) => s + (b.hours || 0), 0).toFixed(1)),
      new Set(filtered.map(b => b.clientName)).size,
      Number(filtered.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + (b.total || 0), 0).toFixed(2)),
      Number(filtered.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + (b.total || 0), 0).toFixed(2)),
      Number(filtered.reduce((s, b) => s + (b.total || 0), 0).toFixed(2))
    ]);
    const wsSum = buildStyledSheet('SPARKLE OPERATIONS — CLEANER EARNINGS', `${periodLabel} · ${filtered.length} jobs`, sumHeaders, sumRows, [16, 8, 10, 10, 14, 14, 14], { totalRow: true, priceCol: 6 });

    const detHeaders = ['DATE', 'CLEANER', 'CLIENT', 'LOCATION', 'TIMING', 'MAT.', 'HRS', 'RATE', 'TOTAL (AED)', 'PAY', 'STATUS'];
    const detRows = filtered.map(b => [
      b.date, b.cleaner, b.clientName, b.location, b.timing,
      b.withMaterials ? 'Yes' : 'No', Number(b.hours), Number(b.pricePerHour),
      Number((b.total || 0).toFixed(2)), b.paymentType, b.paymentStatus || 'PENDING'
    ]);
    const wsDet = buildStyledSheet('EARNINGS DETAIL', `${periodLabel} · all individual jobs`, detHeaders, detRows, [12, 14, 22, 32, 12, 8, 8, 8, 14, 10, 12], {
      statusCol: 10, materialsCol: 5, priceCol: 8
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSum, 'Summary');
    XLSX.utils.book_append_sheet(wb, wsDet, 'Detail');
    XLSX.writeFile(wb, `earnings_${period}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showStatus('✓ Excel downloaded');
  };

  const exportPendingExcel = () => {
    const pending = allBookingsWithDate.filter(b => b.paymentStatus !== 'PAID' && b.total > 0);
    const today = new Date().setHours(0, 0, 0, 0);
    const headers = ['DATE', 'CLIENT', 'PHONE', 'LOCATION', 'CLEANER', 'TIMING', 'HRS', 'AMOUNT (AED)', 'PAY', 'DAYS OVERDUE'];
    const rows = pending.map(b => {
      const overdue = Math.floor((today - new Date(b.date).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
      return [
        b.date, b.clientName, b.phone || '', b.location, b.cleaner, b.timing,
        Number(b.hours), Number(b.total.toFixed(2)), b.paymentType, overdue > 0 ? overdue : 0
      ];
    });
    const totalAmount = pending.reduce((s, b) => s + b.total, 0);
    rows.push(['', '', '', '', '', '', 'TOTAL OWED', Number(totalAmount.toFixed(2)), '', '']);
    const widths = [12, 22, 18, 32, 14, 12, 8, 14, 10, 14];
    const ws = buildStyledSheet('SPARKLE OPERATIONS — PENDING PAYMENTS', `${pending.length} unpaid jobs · ${totalAmount.toFixed(2)} AED outstanding`, headers, rows, widths, {
      totalRow: true, priceCol: 7
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pending Payments');
    XLSX.writeFile(wb, `pending_payments_${new Date().toISOString().split('T')[0]}.xlsx`);
    showStatus('✓ Excel downloaded');
  };

  // Monthly export — comprehensive workbook for chosen month, filterable from UI
  const exportMonthlyExcel = (year, month) => {
    // month is 0-indexed (0=Jan, 11=Dec)
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const monthName = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const monthNameShort = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '_');

    // Filter bookings for this month — use STRING match on 'YYYY-MM' prefix to avoid
    // the timezone bug that would drop the last day of the month (e.g. July 31 in UTC+4).
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthBookings = allBookingsWithDate.filter(b => b.date && b.date.startsWith(monthKey));

    if (monthBookings.length === 0) {
      showStatus('No data for this month');
      return;
    }

    const wb = XLSX.utils.book_new();

    // === SHEET 1: Monthly Overview ===
    const overviewHeaders = ['METRIC', 'VALUE'];
    const totalJobs = monthBookings.length;
    const totalHrs = monthBookings.reduce((s, b) => s + (b.hours || 0), 0);
    const totalRev = monthBookings.reduce((s, b) => s + (b.total || 0), 0);
    const cashTot = monthBookings.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + (b.total || 0), 0);
    const onlineTot = monthBookings.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + (b.total || 0), 0);
    const paidTot = monthBookings.filter(b => b.paymentStatus === 'PAID').reduce((s, b) => s + (b.total || 0), 0);
    const pendingTot = monthBookings.filter(b => b.paymentStatus !== 'PAID').reduce((s, b) => s + (b.total || 0), 0);
    const uniqueClients = new Set(monthBookings.map(b => b.clientName)).size;
    const activeDays = new Set(monthBookings.map(b => b.date)).size;
    const overviewRows = [
      ['Total Jobs Completed', totalJobs],
      ['Total Hours Worked', Number(totalHrs.toFixed(1))],
      ['Active Working Days', activeDays],
      ['Unique Clients Served', uniqueClients],
      ['Cash Collected (AED)', Number(cashTot.toFixed(2))],
      ['Online Collected (AED)', Number(onlineTot.toFixed(2))],
      ['Paid So Far (AED)', Number(paidTot.toFixed(2))],
      ['Pending Payments (AED)', Number(pendingTot.toFixed(2))],
      ['TOTAL REVENUE (AED)', Number(totalRev.toFixed(2))]
    ];
    const wsOverview = buildStyledSheet(`MONTHLY REPORT — ${monthName.toUpperCase()}`, `${totalJobs} jobs · ${totalHrs.toFixed(1)} hours · ${totalRev.toFixed(2)} AED`, overviewHeaders, overviewRows, [32, 22], { totalRow: true });
    XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

    // === SHEET 2: Daily Breakdown ===
    const byDay = {};
    monthBookings.forEach(b => {
      if (!byDay[b.date]) byDay[b.date] = { date: b.date, jobs: 0, hours: 0, revenue: 0, cash: 0, online: 0 };
      byDay[b.date].jobs += 1;
      byDay[b.date].hours += (b.hours || 0);
      byDay[b.date].revenue += (b.total || 0);
      if (b.paymentType === 'CASH') byDay[b.date].cash += (b.total || 0);
      else byDay[b.date].online += (b.total || 0);
    });
    const dailyHeaders = ['DATE', 'DAY', 'JOBS', 'HOURS', 'CASH (AED)', 'ONLINE (AED)', 'TOTAL (AED)'];
    const dailyRows = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).map(d => [
      d.date,
      new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
      d.jobs,
      Number(d.hours.toFixed(1)),
      Number(d.cash.toFixed(2)),
      Number(d.online.toFixed(2)),
      Number(d.revenue.toFixed(2))
    ]);
    dailyRows.push([
      'MONTH TOTAL', '', totalJobs, Number(totalHrs.toFixed(1)),
      Number(cashTot.toFixed(2)), Number(onlineTot.toFixed(2)), Number(totalRev.toFixed(2))
    ]);
    const wsDaily = buildStyledSheet('DAILY BREAKDOWN', `${activeDays} active working days in ${monthName}`, dailyHeaders, dailyRows, [12, 8, 8, 10, 14, 14, 14], { totalRow: true, priceCol: 6 });
    XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily');

    // === SHEET 3: All Jobs Detail ===
    const jobsHeaders = ['DATE', 'DAY', 'CLEANER', 'TIMINGS', 'CLIENT', 'LOCATION', 'PHONE', 'MAT.', 'HRS', 'RATE', 'TOTAL (AED)', 'PAY', 'STATUS'];
    const jobsRows = monthBookings
      .sort((a, b) => a.date.localeCompare(b.date) || a.cleaner.localeCompare(b.cleaner))
      .map(b => [
        b.date,
        new Date(b.date).toLocaleDateString('en-US', { weekday: 'short' }),
        b.cleaner, b.timing, b.clientName, b.location, b.phone || '',
        b.withMaterials ? 'Yes' : 'No', Number(b.hours), Number(b.pricePerHour),
        Number((b.total || 0).toFixed(2)), b.paymentType, b.paymentStatus || 'PENDING'
      ]);
    const wsJobs = buildStyledSheet('ALL JOBS — DETAILED', `${totalJobs} jobs in ${monthName}`, jobsHeaders, jobsRows, [12, 8, 12, 12, 22, 32, 16, 8, 8, 8, 14, 10, 12], {
      statusCol: 12, materialsCol: 7, priceCol: 10
    });
    XLSX.utils.book_append_sheet(wb, wsJobs, 'All Jobs');

    // === SHEET 4: By Cleaner ===
    const cleanerHeaders = ['CLEANER', 'JOBS', 'HOURS', 'CLIENTS', 'CASH (AED)', 'ONLINE (AED)', 'PAID (AED)', 'PENDING (AED)', 'TOTAL (AED)'];
    const cleanerRows = CLEANERS.map(name => {
      const jobs = monthBookings.filter(b => b.cleaner === name);
      return [
        name, jobs.length,
        Number(jobs.reduce((s, b) => s + (b.hours || 0), 0).toFixed(1)),
        new Set(jobs.map(b => b.clientName)).size,
        Number(jobs.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + (b.total || 0), 0).toFixed(2)),
        Number(jobs.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + (b.total || 0), 0).toFixed(2)),
        Number(jobs.filter(b => b.paymentStatus === 'PAID').reduce((s, b) => s + (b.total || 0), 0).toFixed(2)),
        Number(jobs.filter(b => b.paymentStatus !== 'PAID').reduce((s, b) => s + (b.total || 0), 0).toFixed(2)),
        Number(jobs.reduce((s, b) => s + (b.total || 0), 0).toFixed(2))
      ];
    }).filter(r => r[1] > 0); // Only show cleaners who worked
    cleanerRows.push([
      'GRAND TOTAL', totalJobs, Number(totalHrs.toFixed(1)), uniqueClients,
      Number(cashTot.toFixed(2)), Number(onlineTot.toFixed(2)),
      Number(paidTot.toFixed(2)), Number(pendingTot.toFixed(2)), Number(totalRev.toFixed(2))
    ]);
    const wsCleaners = buildStyledSheet('PERFORMANCE BY CLEANER', monthName, cleanerHeaders, cleanerRows, [16, 8, 10, 10, 14, 14, 14, 14, 14], { totalRow: true, priceCol: 8 });
    XLSX.utils.book_append_sheet(wb, wsCleaners, 'By Cleaner');

    // === SHEET 5: By Client ===
    const clientGroups = {};
    monthBookings.forEach(b => {
      const k = b.clientName || 'Unknown';
      if (!clientGroups[k]) clientGroups[k] = { name: k, phone: b.phone || '', address: b.location || '', jobs: 0, hours: 0, revenue: 0, paid: 0, pending: 0 };
      clientGroups[k].jobs += 1;
      clientGroups[k].hours += (b.hours || 0);
      clientGroups[k].revenue += (b.total || 0);
      if (b.paymentStatus === 'PAID') clientGroups[k].paid += (b.total || 0);
      else clientGroups[k].pending += (b.total || 0);
    });
    const clientHeaders = ['CLIENT', 'PHONE', 'LOCATION', 'VISITS', 'HOURS', 'PAID (AED)', 'PENDING (AED)', 'TOTAL (AED)'];
    const clientRows = Object.values(clientGroups)
      .sort((a, b) => b.revenue - a.revenue)
      .map(c => [
        c.name, c.phone, c.address, c.jobs,
        Number(c.hours.toFixed(1)),
        Number(c.paid.toFixed(2)),
        Number(c.pending.toFixed(2)),
        Number(c.revenue.toFixed(2))
      ]);
    clientRows.push([
      'TOTAL', '', '', totalJobs, Number(totalHrs.toFixed(1)),
      Number(paidTot.toFixed(2)), Number(pendingTot.toFixed(2)), Number(totalRev.toFixed(2))
    ]);
    const wsClients = buildStyledSheet('REVENUE BY CLIENT', `${Object.keys(clientGroups).length} unique clients in ${monthName}`, clientHeaders, clientRows, [22, 18, 32, 8, 10, 14, 14, 14], { totalRow: true, priceCol: 7 });
    XLSX.utils.book_append_sheet(wb, wsClients, 'By Client');

    // === SHEET 6: Pending Payments (this month) ===
    const monthPending = monthBookings.filter(b => b.paymentStatus !== 'PAID' && b.total > 0);
    if (monthPending.length > 0) {
      const todaySafe = new Date().setHours(0, 0, 0, 0);
      const pendHeaders = ['DATE', 'CLIENT', 'PHONE', 'LOCATION', 'CLEANER', 'TIMING', 'AMOUNT (AED)', 'PAY', 'DAYS OVERDUE'];
      const pendRows = monthPending
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(b => {
          const overdue = Math.floor((todaySafe - new Date(b.date).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
          return [
            b.date, b.clientName, b.phone || '', b.location, b.cleaner, b.timing,
            Number(b.total.toFixed(2)), b.paymentType, overdue > 0 ? overdue : 0
          ];
        });
      pendRows.push(['', '', '', '', '', 'TOTAL OWED', Number(pendingTot.toFixed(2)), '', '']);
      const wsPend = buildStyledSheet('PENDING PAYMENTS', `${monthPending.length} unpaid · ${pendingTot.toFixed(2)} AED owed`, pendHeaders, pendRows, [12, 22, 18, 32, 14, 12, 14, 10, 14], { totalRow: true, priceCol: 6 });
      XLSX.utils.book_append_sheet(wb, wsPend, 'Pending');
    }

    XLSX.writeFile(wb, `monthly_report_${monthNameShort}.xlsx`);
    showStatus(`✓ ${monthName} report downloaded`);
  };

  // ===== MEGA EXCEL EXPORT (with date range) =====
  const [showExportRange, setShowExportRange] = useState(false);

  const exportEverythingExcel = () => {
    setShowExportRange(true);
  };

  const performMegaExport = (rangeStart, rangeEnd) => {
    const wb = XLSX.utils.book_new();
    const startDate = rangeStart ? new Date(rangeStart) : null;
    const endDate = rangeEnd ? new Date(rangeEnd) : null;
    if (endDate) endDate.setHours(23, 59, 59);

    const inRange = (dateStr) => {
      if (!startDate && !endDate) return true;
      const d = new Date(dateStr);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    };

    const filteredBookings = allBookingsWithDate.filter(b => inRange(b.date));
    const filteredExpenses = expenses.filter(e => inRange(e.date));

    const periodLabel = (startDate && endDate)
      ? `${startDate.toLocaleDateString('en-GB')} → ${endDate.toLocaleDateString('en-GB')}`
      : (startDate ? `From ${startDate.toLocaleDateString('en-GB')}` : (endDate ? `Until ${endDate.toLocaleDateString('en-GB')}` : 'All time'));

    // ===== SHEET 1: DASHBOARD =====
    const totalRev = filteredBookings.reduce((s, b) => s + (b.total || 0), 0);
    const totalExp = filteredExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const profit = totalRev - totalExp;
    const totalJobs = filteredBookings.length;
    const totalHrs = filteredBookings.reduce((s, b) => s + (b.hours || 0), 0);
    const paidJobs = filteredBookings.filter(b => b.paymentStatus === 'PAID').length;
    const pendingJobs = filteredBookings.filter(b => b.paymentStatus !== 'PAID').length;
    const cashTotal = filteredBookings.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + (b.total || 0), 0);
    const onlineTotal = filteredBookings.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + (b.total || 0), 0);
    const paidAmt = filteredBookings.filter(b => b.paymentStatus === 'PAID').reduce((s, b) => s + (b.total || 0), 0);
    const pendingAmt = filteredBookings.filter(b => b.paymentStatus !== 'PAID').reduce((s, b) => s + (b.total || 0), 0);

    // Top cleaners
    const cleanerStats = {};
    CLEANERS.forEach(c => cleanerStats[c] = { jobs: 0, hours: 0, revenue: 0 });
    filteredBookings.forEach(b => {
      if (cleanerStats[b.cleaner]) {
        cleanerStats[b.cleaner].jobs += 1;
        cleanerStats[b.cleaner].hours += b.hours || 0;
        cleanerStats[b.cleaner].revenue += b.total || 0;
      }
    });
    const topCleaners = Object.entries(cleanerStats).filter(([_, s]) => s.jobs > 0).sort((a, b) => b[1].revenue - a[1].revenue);

    // Top clients
    const clientStats = {};
    filteredBookings.forEach(b => {
      const key = b.clientName || 'Unknown';
      if (!clientStats[key]) clientStats[key] = { visits: 0, revenue: 0 };
      clientStats[key].visits += 1;
      clientStats[key].revenue += b.total || 0;
    });
    const topClients = Object.entries(clientStats).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);

    // Expenses by category
    const expByCategory = {};
    filteredExpenses.forEach(e => { expByCategory[e.category] = (expByCategory[e.category] || 0) + parseFloat(e.amount || 0); });
    const topCategories = Object.entries(expByCategory).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Build dashboard sheet
    const dashRows = [
      ['DASHBOARD — ' + (companyInfo.name || 'AR Cleaning Services'), '', '', ''],
      ['Period: ' + periodLabel, '', '', ''],
      ['Generated: ' + new Date().toLocaleString('en-GB'), '', '', ''],
      ['', '', '', ''],
      ['💰 FINANCIAL OVERVIEW', '', '', ''],
      ['Total Revenue', Number(totalRev.toFixed(2)) + ' AED', '', ''],
      ['Total Expenses', Number(totalExp.toFixed(2)) + ' AED', '', ''],
      [profit >= 0 ? 'Net Profit' : 'Net Loss', Number(profit.toFixed(2)) + ' AED', '', ''],
      ['', '', '', ''],
      ['📊 OPERATIONS', '', '', ''],
      ['Total Jobs', totalJobs, '', ''],
      ['Total Hours Worked', Number(totalHrs.toFixed(1)), '', ''],
      ['Active Cleaners', Object.values(cleanerStats).filter(s => s.jobs > 0).length, '', ''],
      ['Unique Clients', Object.keys(clientStats).length, '', ''],
      ['', '', '', ''],
      ['💳 PAYMENTS', '', '', ''],
      ['Paid Jobs', paidJobs + ' jobs', Number(paidAmt.toFixed(2)) + ' AED', ''],
      ['Pending Jobs', pendingJobs + ' jobs', Number(pendingAmt.toFixed(2)) + ' AED', ''],
      ['Cash Revenue', '', Number(cashTotal.toFixed(2)) + ' AED', ''],
      ['Online Revenue', '', Number(onlineTotal.toFixed(2)) + ' AED', ''],
      ['', '', '', ''],
      ['🏆 TOP CLEANERS (by revenue)', 'Jobs', 'Hours', 'Revenue (AED)'],
    ];
    topCleaners.forEach(([name, s]) => {
      dashRows.push([name, s.jobs, Number(s.hours.toFixed(1)), Number(s.revenue.toFixed(2))]);
    });
    dashRows.push(['', '', '', '']);
    dashRows.push(['🌟 TOP 10 CLIENTS (by revenue)', 'Visits', '', 'Revenue (AED)']);
    topClients.forEach(([name, s]) => {
      dashRows.push([name, s.visits, '', Number(s.revenue.toFixed(2))]);
    });
    dashRows.push(['', '', '', '']);
    dashRows.push(['💸 TOP EXPENSE CATEGORIES', '', '', 'Amount (AED)']);
    topCategories.forEach(([cat, amt]) => {
      dashRows.push([cat, '', '', Number(amt.toFixed(2))]);
    });

    // Build Dashboard sheet with styling
    const dashWs = {};
    const headerStyle = {
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FF0F4C3A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'medium', color: { rgb: 'FF1A1A1A' } }, bottom: { style: 'medium', color: { rgb: 'FF1A1A1A' } }, left: { style: 'thin', color: { rgb: 'FF1A1A1A' } }, right: { style: 'thin', color: { rgb: 'FF1A1A1A' } } }
    };
    const sectionStyle = {
      font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FF0F4C3A' } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
      border: { top: { style: 'thin', color: { rgb: 'FFD4CFC0' } }, bottom: { style: 'thin', color: { rgb: 'FFD4CFC0' } } }
    };
    const labelStyle = {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FF1A1A1A' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFAF8F3' } },
      alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
      border: { top: { style: 'thin', color: { rgb: 'FFD4CFC0' } }, bottom: { style: 'thin', color: { rgb: 'FFD4CFC0' } }, left: { style: 'thin', color: { rgb: 'FFD4CFC0' } }, right: { style: 'thin', color: { rgb: 'FFD4CFC0' } } }
    };
    const valueStyle = {
      font: { name: 'Calibri', sz: 11, color: { rgb: 'FF1A1A1A' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFFFF' } },
      alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
      border: { top: { style: 'thin', color: { rgb: 'FFD4CFC0' } }, bottom: { style: 'thin', color: { rgb: 'FFD4CFC0' } }, left: { style: 'thin', color: { rgb: 'FFD4CFC0' } }, right: { style: 'thin', color: { rgb: 'FFD4CFC0' } } }
    };
    const titleStyle = {
      font: { name: 'Calibri', sz: 18, bold: true, color: { rgb: 'FFFFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FF0F4C3A' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const subtitleStyle = {
      font: { name: 'Calibri', sz: 11, italic: true, color: { rgb: 'FFFFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FF0F4C3A' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };

    dashRows.forEach((row, rIdx) => {
      const isTitle = rIdx === 0;
      const isPeriod = rIdx === 1;
      const isGen = rIdx === 2;
      const isSection = typeof row[0] === 'string' && (row[0].startsWith('💰') || row[0].startsWith('📊') || row[0].startsWith('💳') || row[0].startsWith('🏆') || row[0].startsWith('🌟') || row[0].startsWith('💸'));
      const isEmpty = row.every(c => c === '');
      row.forEach((cell, c) => {
        let style;
        if (isTitle) style = titleStyle;
        else if (isPeriod || isGen) style = subtitleStyle;
        else if (isSection) style = sectionStyle;
        else if (isEmpty) style = { fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFFFF' } } };
        else if (c === 0) style = labelStyle;
        else style = valueStyle;
        dashWs[XLSX.utils.encode_cell({ r: rIdx, c })] = {
          v: cell,
          t: typeof cell === 'number' ? 'n' : 's',
          s: style
        };
      });
    });
    dashWs['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: dashRows.length - 1, c: 3 } });
    dashWs['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } }
    ];
    // Merge section header rows
    dashRows.forEach((row, rIdx) => {
      const isSection = typeof row[0] === 'string' && (row[0].startsWith('💰') || row[0].startsWith('📊') || row[0].startsWith('💳'));
      if (isSection) dashWs['!merges'].push({ s: { r: rIdx, c: 0 }, e: { r: rIdx, c: 3 } });
    });
    dashWs['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    dashWs['!rows'] = [{ hpt: 32 }, { hpt: 22 }, { hpt: 18 }];
    XLSX.utils.book_append_sheet(wb, dashWs, '📊 Dashboard');

    // ===== SHEET 2: BOOKINGS =====
    if (filteredBookings.length > 0) {
      const headers = ['DATE', 'CLEANER', 'TIMINGS', 'CLIENT', 'LOCATION', 'PHONE', 'MAT.', 'HRS', 'RATE', 'TOTAL (AED)', 'PAY', 'STATUS'];
      const rows = filteredBookings.map(b => [
        b.date, b.cleaner, b.timing, b.clientName, b.location || '', b.phone || '',
        b.withMaterials ? 'Yes' : 'No', Number((b.hours || 0).toFixed(1)), Number(b.pricePerHour),
        Number((b.total || 0).toFixed(2)), b.paymentType, b.paymentStatus || 'PENDING'
      ]);
      rows.push(['', '', '', '', '', '', 'TOTAL', Number(totalHrs.toFixed(1)), '', Number(totalRev.toFixed(2)), '', '']);
      const ws = buildStyledSheet('ALL BOOKINGS', periodLabel, headers, rows, [12, 12, 12, 22, 32, 16, 8, 8, 8, 14, 10, 12], {
        totalRow: true, statusCol: 11, materialsCol: 6, priceCol: 9
      });
      XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
    }

    // ===== SHEET 3: CLIENTS =====
    if (clients.length > 0) {
      const headers = ['NAME', 'PHONE', 'ADDRESS', 'PINNED LOCATION', 'DEFAULT RATE', 'MATERIALS', 'NOTES'];
      const rows = clients.map(c => [
        c.name, c.phone || '', c.address || '',
        c.lat ? `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` : '',
        Number(c.defaultRate || 25), c.defaultMaterials ? 'Yes' : 'No', c.notes || ''
      ]);
      const ws = buildStyledSheet('CLIENTS DATABASE', `${clients.length} clients`, headers, rows, [22, 16, 32, 22, 14, 12, 28], {});
      XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    }

    // ===== SHEET 4: CONTRACTS =====
    if (contracts.length > 0) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const headers = ['CLIENT', 'CLEANER', 'TIMING', 'DAYS', 'RATE/HR', 'MATERIALS', 'PAY TYPE', 'STATUS'];
      const rows = contracts.map(c => [
        c.clientName, c.cleaner, c.timing,
        (c.daysOfWeek || []).map(d => dayNames[d]).join(', '),
        Number(c.pricePerHour), c.withMaterials ? 'Yes' : 'No', c.paymentType,
        c.active ? 'ACTIVE' : 'PAUSED'
      ]);
      const ws = buildStyledSheet('CONTRACTS', `${contracts.length} contracts`, headers, rows, [22, 12, 12, 22, 10, 12, 12, 12], { statusCol: 7 });
      XLSX.utils.book_append_sheet(wb, ws, 'Contracts');
    }

    // ===== SHEET 5: EXPENSES =====
    if (filteredExpenses.length > 0) {
      const headers = ['DATE', 'CATEGORY', 'DESCRIPTION', 'VENDOR', 'PAYMENT METHOD', 'AMOUNT (AED)', 'NOTES'];
      const rows = filteredExpenses.sort((a, b) => b.date.localeCompare(a.date)).map(e => [
        e.date, e.category, e.description || '', e.vendor || '', e.paymentMethod,
        Number(parseFloat(e.amount || 0).toFixed(2)), e.notes || ''
      ]);
      rows.push(['', '', '', '', 'TOTAL', Number(totalExp.toFixed(2)), '']);
      const ws = buildStyledSheet('EXPENSES', periodLabel, headers, rows, [12, 22, 30, 22, 18, 14, 28], { totalRow: true });
      XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    }

    // ===== SHEET 6: EARNINGS BY CLEANER =====
    if (topCleaners.length > 0) {
      const headers = ['CLEANER', 'JOBS', 'HOURS', 'REVENUE (AED)', 'AVG PER JOB'];
      const rows = topCleaners.map(([name, s]) => [
        name, s.jobs, Number(s.hours.toFixed(1)), Number(s.revenue.toFixed(2)),
        Number((s.revenue / s.jobs).toFixed(2))
      ]);
      const ws = buildStyledSheet('EARNINGS BY CLEANER', periodLabel, headers, rows, [16, 10, 10, 16, 14], {});
      XLSX.utils.book_append_sheet(wb, ws, 'Earnings');
    }

    // ===== SHEET 7: PENDING PAYMENTS =====
    const pendingFiltered = filteredBookings.filter(b => b.paymentStatus !== 'PAID');
    if (pendingFiltered.length > 0) {
      const today = new Date();
      const headers = ['DATE', 'CLIENT', 'PHONE', 'CLEANER', 'AMOUNT (AED)', 'DAYS OVERDUE'];
      const rows = pendingFiltered.sort((a, b) => a.date.localeCompare(b.date)).map(b => {
        const overdue = Math.floor((today - new Date(b.date)) / (1000 * 60 * 60 * 24));
        return [b.date, b.clientName, b.phone || '', b.cleaner, Number((b.total || 0).toFixed(2)), overdue];
      });
      rows.push(['', '', '', 'TOTAL PENDING', Number(pendingAmt.toFixed(2)), '']);
      const ws = buildStyledSheet('PENDING PAYMENTS', `${pendingFiltered.length} unpaid · ${pendingAmt.toFixed(0)} AED`, headers, rows, [12, 22, 16, 12, 14, 14], { totalRow: true });
      XLSX.utils.book_append_sheet(wb, ws, 'Pending');
    }

    // ===== SHEET 8: CLEANER HOMES =====
    const homeEntries = Object.entries(cleanerHomes).filter(([_, h]) => h && h.address);
    if (homeEntries.length > 0) {
      const headers = ['CLEANER', 'HOME ADDRESS', 'PINNED LOCATION'];
      const rows = homeEntries.map(([cleaner, h]) => [
        cleaner, h.address || '', h.lat ? `${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}` : ''
      ]);
      const ws = buildStyledSheet('CLEANER HOMES', `${homeEntries.length} addresses`, headers, rows, [16, 32, 22], {});
      XLSX.utils.book_append_sheet(wb, ws, 'Cleaner Homes');
    }

    // ===== SAVE FILE =====
    const fileName = startDate || endDate
      ? `${(companyInfo.name || 'AR_Cleaning').replace(/\s+/g, '_')}_full_export_${rangeStart || 'start'}_to_${rangeEnd || 'end'}.xlsx`
      : `${(companyInfo.name || 'AR_Cleaning').replace(/\s+/g, '_')}_full_export_alltime.xlsx`;
    XLSX.writeFile(wb, fileName);
    showStatus('✓ Mega export downloaded!');
    setShowExportRange(false);
  };


  const printPage = () => window.print();

  const colors = {
    bg: '#FAF8F3', paper: '#FFFFFF', ink: '#1A1A1A', accent: '#0F4C3A',
    accentLight: '#E8F0EC', gold: '#C9A961', rust: '#B8472A', soft: '#F0EBE0',
    border: '#D4CFC0', headerGreen: '#0F4C3A', cellMaterials: '#D4E8DC',
    cellPlain: '#F5EFD9', priceRed: '#B8472A', warning: '#D97706'
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, fontFamily: '"Inter", -apple-system, sans-serif', color: colors.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        .display-font { font-family: 'Fraunces', serif; letter-spacing: -0.02em; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .btn { padding: 10px 16px; border-radius: 8px; border: 1.5px solid ${colors.border}; background: ${colors.paper}; color: ${colors.ink}; font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; font-family: inherit; }
        .btn:hover { background: ${colors.soft}; }
        .btn-primary { background: ${colors.accent}; color: white; border-color: ${colors.accent}; }
        .btn-primary:hover { background: #0a3a2c; }
        .btn-danger { color: ${colors.rust}; border-color: ${colors.rust}33; }
        .btn-danger:hover { background: ${colors.rust}15; }
        .btn-sm { padding: 6px 10px; font-size: 12px; }
        .input, .select { padding: 8px 10px; border-radius: 6px; border: 1.5px solid ${colors.border}; background: ${colors.paper}; font-size: 13px; font-family: inherit; color: ${colors.ink}; width: 100%; }
        .input:focus, .select:focus { outline: none; border-color: ${colors.accent}; }
        .tab { padding: 12px 16px; background: transparent; border: none; border-bottom: 3px solid transparent; font-weight: 600; font-size: 13px; color: ${colors.ink}88; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
        .tab.active { color: ${colors.accent}; border-bottom-color: ${colors.accent}; }
        .tab:hover:not(.active) { color: ${colors.ink}; }
        @media print { .no-print { display: none !important; } body { background: white !important; } }
        .deployment-cell { border: 1px solid ${colors.ink}; padding: 10px 8px; vertical-align: top; font-size: 12px; line-height: 1.4; text-align: center; min-height: 110px; }
        .grid-table { width: 100%; border-collapse: collapse; background: white; }
        .grid-table th { background: ${colors.cellPlain}; padding: 8px; border: 1px solid ${colors.ink}; font-weight: 700; font-size: 13px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(26,26,26,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
        .modal { background: white; border-radius: 12px; max-width: 600px; width: 100%; max-height: 85vh; overflow: auto; padding: 24px; }
        .day-pill { padding: 6px 10px; border-radius: 6px; border: 1.5px solid ${colors.border}; background: white; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.15s; }
        .day-pill.active { background: ${colors.accent}; color: white; border-color: ${colors.accent}; }
      `}</style>

      <div className="no-print" style={{ background: colors.paper, borderBottom: `1px solid ${colors.border}`, padding: '20px 32px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {companyInfo.logoDataUrl && (
              <img src={companyInfo.logoDataUrl} alt="logo" style={{ height: '54px', width: '54px', objectFit: 'contain', borderRadius: '8px', background: 'white', padding: '4px', border: `1px solid ${colors.border}` }} />
            )}
            <div>
              <h1 className="display-font" style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: colors.accent, letterSpacing: '-0.01em' }}>{companyInfo.name || 'AR Cleaning Services'}</h1>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.ink + '99' }}>Daily operations · clients · earnings · expenses · {companyInfo.phone || 'Abu Dhabi'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {statusMsg && <span style={{ fontSize: '13px', color: colors.accent, fontWeight: 600 }}>{statusMsg}</span>}
            <CloudSyncBadge status={cloudStatus} lastSync={lastSync} colors={colors} />
            <input type="date" className="input" value={date} onChange={e => loadDate(e.target.value)} style={{ width: 'auto' }} />
            <button className="btn btn-primary" onClick={saveDay}><Save size={14} /> Save Day</button>
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: '16px', borderBottom: `1px solid ${colors.border}`, marginLeft: -32, marginRight: -32, paddingLeft: 32, paddingRight: 32, overflowX: 'auto' }}>
          <button className={`tab ${view === 'input' ? 'active' : ''}`} onClick={() => setView('input')}><Plus size={15} /> Bookings ({bookingsWithCalc.length})</button>
          <button className={`tab ${view === 'deployment' ? 'active' : ''}`} onClick={() => setView('deployment')}><Grid3x3 size={15} /> Deployment</button>
          <button className={`tab ${view === 'report' ? 'active' : ''}`} onClick={() => setView('report')}><FileText size={15} /> Daily Report</button>
          <button className={`tab ${view === 'clients' ? 'active' : ''}`} onClick={() => setView('clients')}><BookUser size={15} /> Clients ({clients.length})</button>
          <button className={`tab ${view === 'contracts' ? 'active' : ''}`} onClick={() => setView('contracts')}><Repeat size={15} /> Contracts ({contracts.filter(c=>c.active).length})</button>
          <button className={`tab ${view === 'earnings' ? 'active' : ''}`} onClick={() => setView('earnings')}><TrendingUp size={15} /> Earnings</button>
          <button className={`tab ${view === 'pending' ? 'active' : ''}`} onClick={() => setView('pending')}><AlertCircle size={15} /> Pending</button>
          <button className={`tab ${view === 'monthly' ? 'active' : ''}`} onClick={() => setView('monthly')}><CalendarDays size={15} /> Monthly Report</button>
          <button className={`tab ${view === 'driver' ? 'active' : ''}`} onClick={() => setView('driver')}><Truck size={15} /> Driver</button>
          <button className={`tab ${view === 'invoices' ? 'active' : ''}`} onClick={() => setView('invoices')}><Receipt size={15} /> Invoices</button>
          <button className={`tab ${view === 'expenses' ? 'active' : ''}`} onClick={() => setView('expenses')}><Wallet size={15} /> Expenses</button>
          <button className={`tab ${view === 'payroll' ? 'active' : ''}`} onClick={() => setView('payroll')}><Users size={15} /> Payroll</button>
          <button className={`tab ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}><Settings size={15} /> Settings</button>
        </div>
      </div>

      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        {view === 'input' && <InputView bookings={bookings} bookingsWithCalc={bookingsWithCalc} updateBooking={updateBooking} addBooking={addBooking} removeBooking={removeBooking} clearDay={clearDay} date={date} formatDate={formatDate} colors={colors} totalRevenue={totalRevenue} totalHours={totalHours} cashTotal={cashTotal} onlineTotal={onlineTotal} activeCleaners={activeCleaners} clients={clients} setClientPickerFor={setClientPickerFor} setBookingPinFor={setBookingPinFor} contracts={contracts} generateFromContracts={generateFromContracts} exportEverythingExcel={exportEverythingExcel} />}
        {view === 'deployment' && <DeploymentView byCleaner={byCleaner} CLEANERS={CLEANERS} date={date} formatDate={formatDate} colors={colors} printPage={printPage} />}
        {view === 'report' && <ReportView bookingsWithCalc={bookingsWithCalc} date={date} formatDate={formatDate} colors={colors} totalRevenue={totalRevenue} totalHours={totalHours} cashTotal={cashTotal} onlineTotal={onlineTotal} printPage={printPage} exportCSV={exportCSV} exportDailyReportExcel={exportDailyReportExcel} />}
        {view === 'clients' && <ClientsView clients={clients} saveClients={saveClients} colors={colors} allBookings={allBookingsWithDate} exportClientsExcel={exportClientsExcel} companyInfo={companyInfo} />}
        {view === 'contracts' && <ContractsView contracts={contracts} saveContracts={saveContracts} clients={clients} colors={colors} CLEANERS={CLEANERS} exportContractsExcel={exportContractsExcel} />}
        {view === 'earnings' && <EarningsView allBookings={allBookingsWithDate} CLEANERS={CLEANERS} colors={colors} exportEarningsExcel={exportEarningsExcel} />}
        {view === 'pending' && <PendingView allBookings={allBookingsWithDate} savedDays={savedDays} setSavedDays={setSavedDays} bookings={bookings} setBookings={setBookings} date={date} colors={colors} formatDateShort={formatDateShort} exportPendingExcel={exportPendingExcel} clientCredits={clientCredits} saveClientCredits={saveClientCredits} />}
        {view === 'monthly' && <MonthlyView allBookings={allBookingsWithDate} CLEANERS={CLEANERS} colors={colors} exportMonthlyExcel={exportMonthlyExcel} />}
        {view === 'driver' && <DriverView bookingsWithCalc={bookingsWithCalc} date={date} formatDate={formatDate} colors={colors} cleanerHomes={cleanerHomes} saveCleanerHomes={saveCleanerHomes} officeAddress={officeAddress} saveOfficeAddress={saveOfficeAddress} CLEANER_COLORS={CLEANER_COLORS} CLEANERS={CLEANERS} updateBooking={updateBooking} />}
        {view === 'invoices' && <InvoicesView allBookings={allBookingsWithDate} clients={clients} companyInfo={companyInfo} saveCompanyInfo={saveCompanyInfo} colors={colors} currentDate={date} currentBookings={bookings} savedDays={savedDays} />}
        {view === 'expenses' && <ExpensesView expenses={expenses} saveExpenses={saveExpenses} colors={colors} totalRevenue={totalRevenue} bookingsWithCalc={bookingsWithCalc} allBookings={allBookingsWithDate} payroll={payroll} savePayroll={savePayroll} PAYROLL_ROSTER={PAYROLL_ROSTER} />}
        {view === 'payroll' && <PayrollView payroll={payroll} savePayroll={savePayroll} CLEANERS={CLEANERS} PAYROLL_ROSTER={PAYROLL_ROSTER} colors={colors} />}
        {view === 'settings' && <SettingsView companyInfo={companyInfo} saveCompanyInfo={saveCompanyInfo} colors={colors} cloudStatus={cloudStatus} lastSync={lastSync} bookings={bookings} savedDays={savedDays} clients={clients} contracts={contracts} cleanerHomes={cleanerHomes} officeAddress={officeAddress} expenses={expenses} setCloudStatus={setCloudStatus} setLastSync={setLastSync} />}
      </div>

      {clientPickerFor && <ClientPickerModal clients={clients} onPick={(c) => applyClientToBooking(clientPickerFor, c)} onClose={() => setClientPickerFor(null)} colors={colors} />}
      {bookingPinFor && <LocationPickerModal title="Pin Booking Location" initialLat={bookings.find(b => b.id === bookingPinFor)?.lat} initialLng={bookings.find(b => b.id === bookingPinFor)?.lng} initialAddress={bookings.find(b => b.id === bookingPinFor)?.location || ''} onSave={(lat, lng, address) => { updateBooking(bookingPinFor, 'lat', lat); updateBooking(bookingPinFor, 'lng', lng); if (address) updateBooking(bookingPinFor, 'location', address); setBookingPinFor(null); }} onClose={() => setBookingPinFor(null)} colors={colors} />}
      {showExportRange && <ExportRangeModal onExport={performMegaExport} onClose={() => setShowExportRange(false)} colors={colors} allBookings={allBookingsWithDate} expenses={expenses} />}
    </div>
  );
}

function InputView({ bookings, bookingsWithCalc, updateBooking, addBooking, removeBooking, clearDay, date, formatDate, colors, totalRevenue, totalHours, cashTotal, onlineTotal, activeCleaners, clients, setClientPickerFor, setBookingPinFor, contracts, generateFromContracts, exportEverythingExcel }) {
  const dayOfWeek = new Date(date).getDay();
  const todayContracts = contracts.filter(c => c.active && c.daysOfWeek.includes(dayOfWeek));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button className="btn btn-primary" onClick={exportEverythingExcel} title="Download a complete Excel file with all your data: today's report, all history, clients, contracts, earnings, and pending payments">
          <FileSpreadsheet size={14} /> Export Everything to Excel
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard icon={<DollarSign size={18} />} label="Revenue" value={`${totalRevenue.toFixed(0)} AED`} color={colors.accent} colors={colors} />
        <StatCard icon={<Clock size={18} />} label="Hours" value={`${totalHours.toFixed(1)}`} color={colors.gold} colors={colors} />
        <StatCard icon={<Users size={18} />} label="Cleaners" value={`${activeCleaners}/7`} color={colors.rust} colors={colors} />
        <StatCard icon={<DollarSign size={18} />} label="Cash" value={`${cashTotal.toFixed(0)}`} color={colors.ink} colors={colors} />
        <StatCard icon={<DollarSign size={18} />} label="Online" value={`${onlineTotal.toFixed(0)}`} color={colors.ink} colors={colors} />
      </div>

      {todayContracts.length > 0 && (
        <div style={{ background: colors.accentLight, border: `1.5px solid ${colors.accent}`, borderRadius: '10px', padding: '14px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontWeight: 700, color: colors.accent, fontSize: '14px' }}>
              <Repeat size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
              {todayContracts.length} recurring contract{todayContracts.length > 1 ? 's' : ''} for this day
            </div>
            <div style={{ fontSize: '12px', color: colors.ink + 'AA', marginTop: '2px' }}>{todayContracts.map(c => c.clientName).join(', ')}</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={generateFromContracts}><Plus size={14} /> Auto-fill from contracts</button>
        </div>
      )}

      <div style={{ background: colors.paper, borderRadius: '12px', border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <h3 className="display-font" style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Bookings · {formatDate(date)}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-danger btn-sm" onClick={clearDay}><RotateCcw size={14} /> Clear</button>
            <button className="btn btn-primary btn-sm" onClick={addBooking}><Plus size={14} /> Add Booking</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1200px' }}>
            <thead>
              <tr style={{ background: colors.soft }}>
                <Th>Cleaner</Th><Th>Time</Th><Th>Client</Th><Th>Location / Phone</Th>
                <Th>Pickup</Th><Th>Mat.</Th><Th>Rate</Th><Th>Hrs</Th><Th>Total</Th><Th>Pay</Th><Th>Status</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => {
                const hours = parseHours(b.timing);
                const total = hours * parseFloat(b.pricePerHour || 0);
                return (
                  <tr key={b.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                    <Td><select className="select" value={b.cleaner} onChange={e => updateBooking(b.id, 'cleaner', e.target.value)}>
                      {CLEANERS.map(c => <option key={c}>{c}</option>)}
                    </select></Td>
                    <Td><input className="input" placeholder="8-10" value={b.timing} onChange={e => updateBooking(b.id, 'timing', e.target.value)} style={{ width: '90px' }} /></Td>
                    <Td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input className="input" placeholder="Client name" value={b.clientName} onChange={e => updateBooking(b.id, 'clientName', e.target.value)} style={{ minWidth: '120px' }} />
                        {clients.length > 0 && <button className="btn btn-sm" onClick={() => setClientPickerFor(b.id)} title="Pick from list" style={{ padding: '6px 8px' }}><BookUser size={14} /></button>}
                      </div>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: '3px', marginBottom: '3px' }}>
                        <input className="input" placeholder="Apt 101 Bldg" value={b.location} onChange={e => updateBooking(b.id, 'location', e.target.value)} style={{ minWidth: '160px' }} />
                        <button className="btn btn-sm" title={b.lat ? `Pinned at ${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}` : 'Pin location on map'} onClick={() => setBookingPinFor(b.id)} style={{ padding: '6px 8px', background: b.lat ? colors.accentLight : 'white', borderColor: b.lat ? colors.accent : colors.border }}>
                          <MapPin size={14} style={{ color: b.lat ? colors.accent : colors.ink + '99' }} />
                        </button>
                      </div>
                      <input className="input" placeholder="Phone" value={b.phone || ''} onChange={e => updateBooking(b.id, 'phone', e.target.value)} style={{ fontSize: '11px', padding: '4px 8px', minWidth: '180px' }} />
                    </Td>
                    <Td>
                      <select className="select" value={b.pickupType || 'OFFICE'} onChange={e => updateBooking(b.id, 'pickupType', e.target.value)} style={{ width: '85px', fontSize: '11px' }}>
                        {PICKUP_TYPES.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </Td>
                    <Td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={b.withMaterials} onChange={e => updateBooking(b.id, 'withMaterials', e.target.checked)} style={{ transform: 'scale(1.3)', cursor: 'pointer' }} />
                    </Td>
                    <Td><input className="input" type="number" value={b.pricePerHour} onChange={e => updateBooking(b.id, 'pricePerHour', e.target.value)} style={{ width: '70px' }} /></Td>
                    <Td className="mono" style={{ fontWeight: 600 }}>{hours.toFixed(1)}</Td>
                    <Td className="mono" style={{ fontWeight: 700, color: colors.accent }}>{total.toFixed(0)}</Td>
                    <Td><select className="select" value={b.paymentType} onChange={e => updateBooking(b.id, 'paymentType', e.target.value)}>
                      {PAYMENT_TYPES.map(p => <option key={p}>{p}</option>)}
                    </select></Td>
                    <Td><select className="select" value={b.paymentStatus || 'PENDING'} onChange={e => updateBooking(b.id, 'paymentStatus', e.target.value)} style={{ background: b.paymentStatus === 'PAID' ? '#D4E8DC' : '#FEE2E2' }}>
                      {PAYMENT_STATUS.map(p => <option key={p}>{p}</option>)}
                    </select></Td>
                    <Td><button className="btn btn-danger btn-sm" onClick={() => removeBooking(b.id)} style={{ padding: '6px 8px' }}><Trash2 size={14} /></button></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '14px 20px', background: colors.soft, fontSize: '12px', color: colors.ink + '99' }}>
          <strong>Tips:</strong> Click <BookUser size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> to load saved client · Time format <span className="mono">8-10</span> · Mark PAID once payment received
        </div>
      </div>
    </div>
  );
}

function ClientsView({ clients, saveClients, colors, allBookings, exportClientsExcel, companyInfo }) {
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [showPinPicker, setShowPinPicker] = useState(false);
  const [reminderFor, setReminderFor] = useState(null); // client object when reminder modal is open

  const startNew = () => setEditing(emptyClient());
  const startEdit = (c) => setEditing({ ...c });
  const cancelEdit = () => setEditing(null);

  const save = () => {
    if (!editing.name.trim()) return alert('Client name required');
    const exists = clients.find(c => c.id === editing.id);
    saveClients(exists ? clients.map(c => c.id === editing.id ? editing : c) : [...clients, editing]);
    setEditing(null);
  };

  const remove = (id) => { if (confirm('Delete this client?')) saveClients(clients.filter(c => c.id !== id)); };

  const filtered = clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.address.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  const clientStats = (clientId) => {
    const visits = allBookings.filter(b => b.clientId === clientId);
    const sortedDates = visits.map(b => b.date).sort();
    const lastVisitDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;
    const daysSince = lastVisitDate ? Math.floor((new Date() - new Date(lastVisitDate)) / (1000 * 60 * 60 * 24)) : null;
    return { visits: visits.length, revenue: visits.reduce((s, b) => s + (b.total || 0), 0), lastVisitDate, daysSince };
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Client Database</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>{clients.length} saved clients · auto-fills bookings & contracts</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: colors.ink + '66' }} />
            <input className="input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '32px', width: '200px' }} />
          </div>
          {clients.length > 0 && <button className="btn" onClick={exportClientsExcel}><FileSpreadsheet size={14} /> Excel</button>}
          <button className="btn btn-primary" onClick={startNew}><Plus size={14} /> New Client</button>
        </div>
      </div>

      {clients.length === 0 && !editing && (
        <div style={{ background: 'white', borderRadius: '12px', border: `1px dashed ${colors.border}`, padding: '60px 20px', textAlign: 'center', color: colors.ink + '99' }}>
          <BookUser size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px' }}>No clients saved yet</h3>
          <p style={{ fontSize: '13px', margin: '0 0 16px' }}>Save your regular clients here to auto-fill bookings.</p>
          <button className="btn btn-primary" onClick={startNew}><Plus size={14} /> Add First Client</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
        {filtered.map(c => {
          const stats = clientStats(c.id);
          return (
            <div key={c.id} style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="display-font" style={{ fontSize: '18px', fontWeight: 700 }}>{c.name}</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {c.phone && (
                    <button className="btn btn-sm" onClick={() => setReminderFor(c)} title="Send WhatsApp reminder" style={{ padding: '4px 8px', background: '#25D366', color: 'white', borderColor: '#25D366' }}>
                      <MessageCircle size={12} />
                    </button>
                  )}
                  <button className="btn btn-sm" onClick={() => startEdit(c)} style={{ padding: '4px 8px' }}><Edit2 size={12} /></button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)} style={{ padding: '4px 8px' }}><Trash2 size={12} /></button>
                </div>
              </div>
              {c.phone && <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12} /> <span className="mono">{c.phone}</span></div>}
              {c.address && <div style={{ fontSize: '12px', color: colors.ink + 'BB', display: 'flex', gap: '6px' }}><MapPin size={12} style={{ flexShrink: 0, marginTop: '2px' }} /> <span>{c.address}</span></div>}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: colors.soft }}>{c.defaultRate} AED/hr</span>
                {c.defaultMaterials && <span className="badge" style={{ background: colors.cellMaterials, color: colors.accent }}>w/ materials</span>}
                {stats.daysSince !== null && (
                  <span className="badge" style={{
                    background: stats.daysSince > 30 ? '#FEE2E2' : stats.daysSince > 14 ? '#FEF3C7' : colors.cellMaterials,
                    color: stats.daysSince > 30 ? '#B8472A' : stats.daysSince > 14 ? '#D97706' : colors.accent,
                    fontWeight: 700
                  }}>
                    {stats.daysSince === 0 ? 'today' : stats.daysSince === 1 ? '1 day ago' : `${stats.daysSince} days ago`}
                  </span>
                )}
              </div>
              {stats.visits > 0 && (
                <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: `1px solid ${colors.border}`, fontSize: '11px', color: colors.ink + '99', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{stats.visits} visit{stats.visits > 1 ? 's' : ''}</span>
                  <span style={{ color: colors.accent, fontWeight: 600 }}>{stats.revenue.toFixed(0)} AED total</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={cancelEdit}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="display-font" style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>{clients.find(c => c.id === editing.id) ? 'Edit Client' : 'New Client'}</h3>
              <button className="btn btn-sm" onClick={cancelEdit} style={{ padding: '6px' }}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label="Name *"><input className="input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Phone"><input className="input" value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} placeholder="+971 50 ..." /></Field>
              <Field label="Address">
                <textarea className="input" value={editing.address} onChange={e => setEditing({ ...editing, address: e.target.value })} placeholder="Apt 101, Building Name, Area, Abu Dhabi" rows="2" style={{ resize: 'vertical' }} />
              </Field>
              <Field label="Pin Location on Map">
                <button type="button" className="btn" onClick={() => setShowPinPicker(true)} style={{ background: editing.lat ? colors.accentLight : 'white', borderColor: editing.lat ? colors.accent : colors.border, justifyContent: 'flex-start', width: '100%' }}>
                  <MapPin size={14} style={{ color: editing.lat ? colors.accent : colors.ink + '99' }} />
                  {editing.lat ? `📍 Pinned at ${editing.lat.toFixed(5)}, ${editing.lng.toFixed(5)}` : 'Click to pin location on map'}
                </button>
                {editing.lat && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <a href={`https://www.google.com/maps/?q=${editing.lat},${editing.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: colors.accent, fontWeight: 600 }}>
                      🗺️ View in Google Maps
                    </a>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setEditing({ ...editing, lat: null, lng: null })} style={{ padding: '3px 8px', fontSize: '10px' }}>
                      <X size={10} /> Remove pin
                    </button>
                  </div>
                )}
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Default Rate/hr"><input className="input" type="number" value={editing.defaultRate} onChange={e => setEditing({ ...editing, defaultRate: parseFloat(e.target.value) || 0 })} /></Field>
                <Field label="Materials"><label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', fontSize: '13px' }}><input type="checkbox" checked={editing.defaultMaterials} onChange={e => setEditing({ ...editing, defaultMaterials: e.target.checked })} style={{ transform: 'scale(1.2)' }} />With materials</label></Field>
              </div>
              <Field label="Notes"><textarea className="input" value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} rows="2" style={{ resize: 'vertical' }} /></Field>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn" onClick={cancelEdit}>Cancel</button>
              <button className="btn btn-primary" onClick={save}><Save size={14} /> Save Client</button>
            </div>
          </div>
        </div>
      )}
      {editing && showPinPicker && (
        <LocationPickerModal
          title="Pin Client Location"
          initialLat={editing.lat}
          initialLng={editing.lng}
          initialAddress={editing.address}
          onSave={(lat, lng, address) => {
            setEditing({ ...editing, lat, lng, address: address || editing.address });
            setShowPinPicker(false);
          }}
          onClose={() => setShowPinPicker(false)}
          colors={colors}
        />
      )}
      {reminderFor && (
        <WhatsAppReminderModal
          client={reminderFor}
          companyInfo={companyInfo}
          stats={clientStats(reminderFor.id)}
          colors={colors}
          onClose={() => setReminderFor(null)}
        />
      )}
    </div>
  );
}

function ClientPickerModal({ clients, onPick, onClose, colors }) {
  const [search, setSearch] = useState('');
  const filtered = clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="display-font" style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Pick a client</h3>
          <button className="btn btn-sm" onClick={onClose} style={{ padding: '6px' }}><X size={14} /></button>
        </div>
        <input className="input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} autoFocus style={{ marginBottom: '12px' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
          {filtered.map(c => (
            <button key={c.id} onClick={() => onPick(c)} style={{ padding: '10px 14px', textAlign: 'left', background: 'white', border: `1px solid ${colors.border}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'inherit' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{c.name}</div>
                <div style={{ fontSize: '11px', color: colors.ink + 'AA', marginTop: '2px' }}>{c.address}</div>
              </div>
              <ChevronRight size={16} style={{ color: colors.ink + '66' }} />
            </button>
          ))}
          {filtered.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: colors.ink + '66', fontSize: '13px' }}>No clients found</div>}
        </div>
      </div>
    </div>
  );
}

function ContractsView({ contracts, saveContracts, clients, colors, CLEANERS, exportContractsExcel }) {
  const [editing, setEditing] = useState(null);

  const startNew = () => {
    if (clients.length === 0) return alert('Add at least one client first in the Clients tab');
    setEditing(emptyContract());
  };
  const startEdit = (c) => setEditing({ ...c });

  const save = () => {
    if (!editing.clientId) return alert('Pick a client');
    if (editing.daysOfWeek.length === 0) return alert('Pick at least one day');
    if (!editing.timing) return alert('Add timing');
    const client = clients.find(c => c.id === editing.clientId);
    const final = { ...editing, clientName: client.name };
    const exists = contracts.find(c => c.id === editing.id);
    saveContracts(exists ? contracts.map(c => c.id === editing.id ? final : c) : [...contracts, final]);
    setEditing(null);
  };

  const toggleDay = (dayIdx) => {
    const has = editing.daysOfWeek.includes(dayIdx);
    setEditing({ ...editing, daysOfWeek: has ? editing.daysOfWeek.filter(d => d !== dayIdx) : [...editing.daysOfWeek, dayIdx].sort() });
  };

  const toggleActive = (id) => saveContracts(contracts.map(c => c.id === id ? { ...c, active: !c.active } : c));
  const remove = (id) => { if (confirm('Delete this contract?')) saveContracts(contracts.filter(c => c.id !== id)); };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Monthly Contracts</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>Recurring weekly jobs · auto-fill the schedule on the right day</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {contracts.length > 0 && <button className="btn" onClick={exportContractsExcel}><FileSpreadsheet size={14} /> Excel</button>}
          <button className="btn btn-primary" onClick={startNew}><Plus size={14} /> New Contract</button>
        </div>
      </div>

      {contracts.length === 0 && !editing && (
        <div style={{ background: 'white', borderRadius: '12px', border: `1px dashed ${colors.border}`, padding: '60px 20px', textAlign: 'center', color: colors.ink + '99' }}>
          <Repeat size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px' }}>No recurring contracts</h3>
          <p style={{ fontSize: '13px', margin: '0 0 16px' }}>Set up regular jobs (e.g. "Manisha every Friday 8-10am") to skip re-entering them every week.</p>
          <button className="btn btn-primary" onClick={startNew}><Plus size={14} /> Add Contract</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {contracts.map(c => (
          <div key={c.id} style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', opacity: c.active ? 1 : 0.55 }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <div className="display-font" style={{ fontSize: '17px', fontWeight: 700 }}>{c.clientName}</div>
                {!c.active && <span className="badge" style={{ background: '#FEE2E2', color: colors.rust }}>PAUSED</span>}
              </div>
              <div style={{ fontSize: '12px', color: colors.ink + 'AA', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <span><strong>{c.cleaner}</strong></span>
                <span className="mono">{c.timing}</span>
                <span>{c.daysOfWeek.map(d => DAYS[d]).join(', ')}</span>
                <span style={{ color: colors.accent, fontWeight: 600 }}>{c.pricePerHour} AED/hr</span>
                {c.withMaterials && <span style={{ color: colors.accent }}>w/ materials</span>}
                <span>{c.paymentType}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-sm" onClick={() => toggleActive(c.id)}>{c.active ? 'Pause' : 'Resume'}</button>
              <button className="btn btn-sm" onClick={() => startEdit(c)}><Edit2 size={12} /></button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)} style={{ padding: '6px 8px' }}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="display-font" style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>{contracts.find(c => c.id === editing.id) ? 'Edit Contract' : 'New Contract'}</h3>
              <button className="btn btn-sm" onClick={() => setEditing(null)} style={{ padding: '6px' }}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label="Client *">
                <select className="select" value={editing.clientId || ''} onChange={e => setEditing({ ...editing, clientId: e.target.value })}>
                  <option value="">— Pick a client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} · {c.address}</option>)}
                </select>
              </Field>
              <Field label="Assigned Cleaner *">
                <select className="select" value={editing.cleaner} onChange={e => setEditing({ ...editing, cleaner: e.target.value })}>
                  {CLEANERS.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Days of week *">
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {DAYS.map((d, i) => <button key={i} type="button" className={`day-pill ${editing.daysOfWeek.includes(i) ? 'active' : ''}`} onClick={() => toggleDay(i)}>{d}</button>)}
                </div>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Timing *"><input className="input" placeholder="8:00-10:00" value={editing.timing} onChange={e => setEditing({ ...editing, timing: e.target.value })} /></Field>
                <Field label="Rate/hr"><input className="input" type="number" value={editing.pricePerHour} onChange={e => setEditing({ ...editing, pricePerHour: parseFloat(e.target.value) || 0 })} /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Payment Type"><select className="select" value={editing.paymentType} onChange={e => setEditing({ ...editing, paymentType: e.target.value })}>{PAYMENT_TYPES.map(p => <option key={p}>{p}</option>)}</select></Field>
                <Field label="Materials"><label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', fontSize: '13px' }}><input type="checkbox" checked={editing.withMaterials} onChange={e => setEditing({ ...editing, withMaterials: e.target.checked })} style={{ transform: 'scale(1.2)' }} />With materials</label></Field>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}><Save size={14} /> Save Contract</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EarningsView({ allBookings, CLEANERS, colors, exportEarningsExcel }) {
  const [period, setPeriod] = useState('month');
  const now = new Date();
  const filterStart = new Date();
  if (period === 'week') filterStart.setDate(now.getDate() - 7);
  else if (period === 'month') filterStart.setDate(1);
  else filterStart.setFullYear(2000);
  const filtered = allBookings.filter(b => new Date(b.date) >= filterStart);

  const stats = CLEANERS.map(name => {
    const jobs = filtered.filter(b => b.cleaner === name);
    return {
      name, jobs: jobs.length,
      hours: jobs.reduce((s, b) => s + (b.hours || 0), 0),
      revenue: jobs.reduce((s, b) => s + (b.total || 0), 0),
      cash: jobs.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + (b.total || 0), 0),
      online: jobs.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + (b.total || 0), 0),
      uniqueClients: new Set(jobs.map(b => b.clientName)).size
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const grandTotal = stats.reduce((s, x) => s + x.revenue, 0);
  const grandHours = stats.reduce((s, x) => s + x.hours, 0);
  const maxRevenue = Math.max(1, ...stats.map(s => s.revenue));
  const periodLabel = period === 'week' ? 'Last 7 days' : period === 'month' ? 'This month' : 'All time';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Cleaner Earnings Report</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>{periodLabel} · {filtered.length} total jobs</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '8px', padding: '4px', border: `1px solid ${colors.border}` }}>
            {[['week', 'Week'], ['month', 'Month'], ['all', 'All time']].map(([k, lbl]) => (
              <button key={k} className={`btn btn-sm ${period === k ? 'btn-primary' : ''}`} onClick={() => setPeriod(k)} style={{ border: 'none' }}>{lbl}</button>
            ))}
          </div>
          {filtered.length > 0 && <button className="btn btn-primary" onClick={() => exportEarningsExcel(period, filtered)}><FileSpreadsheet size={14} /> Excel</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard icon={<DollarSign size={18} />} label="Total Revenue" value={`${grandTotal.toFixed(0)} AED`} color={colors.accent} colors={colors} />
        <StatCard icon={<Clock size={18} />} label="Total Hours" value={`${grandHours.toFixed(1)}`} color={colors.gold} colors={colors} />
        <StatCard icon={<FileText size={18} />} label="Total Jobs" value={filtered.length} color={colors.rust} colors={colors} />
        <StatCard icon={<DollarSign size={18} />} label="Avg/Job" value={filtered.length ? `${(grandTotal / filtered.length).toFixed(0)} AED` : '—'} color={colors.ink} colors={colors} />
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '24px' }}>
        <h3 className="display-font" style={{ margin: '0 0 18px', fontSize: '18px', fontWeight: 700 }}>By Cleaner</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {stats.map(s => (
            <div key={s.name} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <span className="display-font" style={{ fontSize: '17px', fontWeight: 700 }}>{s.name}</span>
                  <span style={{ fontSize: '12px', color: colors.ink + 'AA' }}>{s.jobs} jobs · {s.hours.toFixed(1)} hrs · {s.uniqueClients} clients</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '11px', color: colors.ink + '99' }}>Cash <span className="mono" style={{ color: colors.rust, fontWeight: 600 }}>{s.cash.toFixed(0)}</span></span>
                  <span style={{ fontSize: '11px', color: colors.ink + '99' }}>Online <span className="mono" style={{ color: colors.accent, fontWeight: 600 }}>{s.online.toFixed(0)}</span></span>
                  <span className="display-font" style={{ fontSize: '20px', fontWeight: 700, color: colors.accent, minWidth: '90px', textAlign: 'right' }}>{s.revenue.toFixed(0)} AED</span>
                </div>
              </div>
              <div style={{ height: '8px', background: colors.soft, borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(s.revenue / maxRevenue) * 100}%`, background: `linear-gradient(90deg, ${colors.accent}, ${colors.gold})`, transition: 'width 0.5s ease' }}></div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: colors.ink + '66' }}>No data for this period yet.</div>}
        </div>
      </div>
    </div>
  );
}

function PendingView({ allBookings, savedDays, setSavedDays, bookings, setBookings, date, colors, formatDateShort, exportPendingExcel, clientCredits, saveClientCredits }) {
  const [expanded, setExpanded] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Payment modal state: null when closed, or { items, defaultType, defaultAmount, clientName, date }
  const [payModal, setPayModal] = useState(null);
  const toggleExpand = (key) => {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpanded(next);
  };

  // Start with all unpaid jobs
  const allPending = allBookings.filter(b => b.paymentStatus !== 'PAID' && b.total > 0);
  const allPendingTotal = allPending.reduce((s, b) => s + b.total, 0);

  // Apply filters (search text + date range)
  const q = searchQuery.trim().toLowerCase();
  const pending = allPending.filter(b => {
    if (dateFrom && b.date < dateFrom) return false;
    if (dateTo && b.date > dateTo) return false;
    if (q) {
      const blob = `${b.clientName || ''} ${b.cleaner || ''} ${b.location || ''} ${b.phone || ''}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
  const totalPending = pending.reduce((s, b) => s + b.total, 0);
  const isFiltered = q.length > 0 || dateFrom.length > 0 || dateTo.length > 0;
  const clearFilters = () => { setSearchQuery(''); setDateFrom(''); setDateTo(''); };

  // Group by client, then by day (so multiple cleaners on the same day for the same client roll up into one payment)
  const byClient = {};
  pending.forEach(b => {
    const clientKey = b.clientName || 'Unknown';
    if (!byClient[clientKey]) byClient[clientKey] = { name: clientKey, phone: b.phone, days: {}, total: 0 };
    const dayKey = b.date;
    if (!byClient[clientKey].days[dayKey]) {
      byClient[clientKey].days[dayKey] = { date: dayKey, items: [], total: 0, cleaners: new Set(), paymentTypes: new Set(), locations: new Set() };
    }
    const day = byClient[clientKey].days[dayKey];
    day.items.push(b);
    day.total += b.total;
    if (b.cleaner) day.cleaners.add(b.cleaner);
    if (b.paymentType) day.paymentTypes.add(b.paymentType);
    if (b.location) day.locations.add(b.location);
    byClient[clientKey].total += b.total;
  });
  const groups = Object.values(byClient).map(g => ({
    ...g,
    daysList: Object.values(g.days).sort((a, b) => new Date(a.date) - new Date(b.date)),
    jobCount: Object.values(g.days).reduce((s, d) => s + d.items.length, 0),
  })).sort((a, b) => b.total - a.total);

  // Open the payment modal with a single job selected
  const openPayModalForSingle = (booking) => {
    setPayModal({
      items: [booking],
      clientName: booking.clientName || 'Unknown',
      dates: [booking.date],
      defaultType: booking.paymentType || 'CASH',
      owedAmount: booking.total,
      scope: 'single',
    });
  };

  // Open the payment modal with a whole day for a client selected
  const openPayModalForDay = (clientName, dayData) => {
    setPayModal({
      items: dayData.items,
      clientName,
      dates: [dayData.date],
      defaultType: dayData.items[0]?.paymentType || 'CASH',
      owedAmount: dayData.total,
      scope: 'day',
    });
  };

  // BULK: Open the payment modal with ALL of a client's unpaid jobs across every day.
  // This is the big time-saver for clients who pay the full outstanding amount at once.
  const openPayModalForClient = (clientGroup) => {
    const allItems = clientGroup.daysList.flatMap(d => d.items);
    const uniqueDates = [...new Set(allItems.map(i => i.date))].sort();
    // Prefer the most common payment method
    const typeCounts = {};
    allItems.forEach(i => { typeCounts[i.paymentType || 'CASH'] = (typeCounts[i.paymentType || 'CASH'] || 0) + 1; });
    const defaultType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'CASH';
    setPayModal({
      items: allItems,
      clientName: clientGroup.name,
      dates: uniqueDates,
      defaultType,
      owedAmount: clientGroup.total,
      scope: 'client',
    });
  };

  // BULK: Open the payment modal with ALL currently filtered pending jobs across all clients.
  // Use this to clear massive backlogs — e.g. after month-end reconciliation.
  const openPayModalForAllVisible = () => {
    if (pending.length === 0) return;
    const uniqueDates = [...new Set(pending.map(i => i.date))].sort();
    const typeCounts = {};
    pending.forEach(i => { typeCounts[i.paymentType || 'CASH'] = (typeCounts[i.paymentType || 'CASH'] || 0) + 1; });
    const defaultType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'CASH';
    // For bulk-all, we use "MIXED" clientName because it spans clients.
    // Credit balances aren't tracked for MIXED because we can't attribute overpayment to one client.
    const clientNames = [...new Set(pending.map(i => i.clientName || 'Unknown'))];
    setPayModal({
      items: pending,
      clientName: clientNames.length === 1 ? clientNames[0] : `${clientNames.length} clients`,
      dates: uniqueDates,
      defaultType,
      owedAmount: pending.reduce((s, i) => s + i.total, 0),
      scope: 'all',
      multiClient: clientNames.length > 1,
    });
  };

  // Actually apply the payment when the user confirms in the modal.
  // Now handles multi-date bulk payments by grouping items by their booking date.
  const confirmPayment = async ({ paymentType, amountReceived, keepOriginalMethod }) => {
    if (!payModal) return;
    const ids = new Set(payModal.items.map(i => i.id));
    const dates = payModal.dates || [];
    const owed = payModal.owedAmount;
    const received = Number(amountReceived) || owed;
    const overpayment = received - owed;

    // Build the updater. If "keep original method" is on (bulk case), don't overwrite paymentType.
    const applyUpdate = (list) => list.map(b => {
      if (!ids.has(b.id)) return b;
      const patch = { paymentStatus: 'PAID' };
      if (!keepOriginalMethod) patch.paymentType = paymentType;
      return { ...b, ...patch };
    });

    // Update current day's bookings if the current view's date is in the affected set
    if (dates.includes(date)) {
      setBookings(applyUpdate(bookings));
    }
    // Update every affected saved day in one pass
    let updatedDays = { ...savedDays };
    let hasChanges = false;
    dates.forEach(d => {
      if (updatedDays[d]) {
        updatedDays[d] = { ...updatedDays[d], bookings: applyUpdate(updatedDays[d].bookings) };
        hasChanges = true;
      }
    });
    if (hasChanges) {
      setSavedDays(updatedDays);
      try { localStorage.setItem('sparkle_all_days', JSON.stringify(updatedDays)); } catch (e) {}
    }

    // Track over/underpayment as credit — only for single-client scopes (skip multi-client bulk)
    if (overpayment !== 0 && !payModal.multiClient) {
      const cn = payModal.clientName;
      const existing = clientCredits[cn] || { balance: 0, history: [] };
      const nextBalance = (existing.balance || 0) + overpayment;
      const dateLabel = dates.length === 1 ? dates[0] : `${dates.length} days`;
      const nextCredits = {
        ...clientCredits,
        [cn]: {
          balance: nextBalance,
          history: [
            ...(existing.history || []),
            {
              date: new Date().toISOString().slice(0, 10),
              amount: overpayment,
              type: overpayment > 0 ? 'credit' : 'debit',
              note: overpayment > 0
                ? `Overpaid ${overpayment.toFixed(2)} AED on ${dateLabel} payment (received ${received}, owed ${owed})`
                : `Underpaid ${Math.abs(overpayment).toFixed(2)} AED on ${dateLabel} payment (received ${received}, owed ${owed})`
            },
          ],
        },
      };
      saveClientCredits(nextCredits);
    }

    setPayModal(null);

    // ===== PERSIST PAID STATUS TO SUPABASE =====
    // Without this, "Mark Paid" only updates local state + localStorage, and the next
    // page load overwrites it with the (still-PENDING) cloud copy — so payments revert.
    // Mirror the "Save Day" upsert for every affected saved day, in one batched call.
    const cloudRows = [];
    dates.forEach(d => {
      if (updatedDays[d]) {
        cloudRows.push({ date: d, bookings: updatedDays[d].bookings, saved_at: new Date().toISOString() });
      }
    });
    if (cloudRows.length > 0) {
      try {
        const { error } = await supabase.from('days').upsert(cloudRows);
        if (error) throw error;
      } catch (e) {
        console.error('Payment cloud-sync error:', e);
        // Surface the failure instead of hiding it — a silent failure here is exactly
        // what made payments silently revert before.
        alert(
          '⚠ Payment was saved on THIS device but did NOT sync to the cloud.\n\n' +
          'It may reappear as unpaid after a refresh or on another device.\n\n' +
          'Error: ' + (e?.message || 'unknown') + '\n\n' +
          'Check your internet connection and try marking it paid again.'
        );
      }
    }
  };

  const today = new Date().setHours(0, 0, 0, 0);
  const daysOverdue = (d) => Math.floor((today - new Date(d).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Pending Payments</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>
            {isFiltered ? (
              <>Showing <strong>{pending.length}</strong> of {allPending.length} unpaid jobs · <strong>{groups.length}</strong> {groups.length === 1 ? 'client' : 'clients'}</>
            ) : (
              <>{pending.length} unpaid jobs · grouped by client &amp; day across {groups.length} {groups.length === 1 ? 'client' : 'clients'}</>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {pending.length > 0 && (
            <button
              onClick={openPayModalForAllVisible}
              className="btn btn-primary"
              style={{ background: colors.rust, borderColor: colors.rust }}
              title={`Mark all ${pending.length} ${isFiltered ? 'filtered' : ''} pending jobs as paid in one action`}
            >
              <Check size={14} /> Mark All {pending.length} Paid
            </button>
          )}
          {pending.length > 0 && <button className="btn btn-primary" onClick={exportPendingExcel}><FileSpreadsheet size={14} /> Excel</button>}
          <div style={{ padding: '12px 20px', background: pending.length ? '#FEF3C7' : colors.accentLight, border: `1.5px solid ${pending.length ? colors.warning : colors.accent}`, borderRadius: '10px', textAlign: 'right' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.ink + '99', fontWeight: 600 }}>{isFiltered ? 'Filtered' : 'Outstanding'}</div>
            <div className="display-font" style={{ fontSize: '24px', fontWeight: 800, color: pending.length ? colors.warning : colors.accent }}>{totalPending.toFixed(2)} AED</div>
            {isFiltered && <div style={{ fontSize: '10px', color: colors.ink + '77', marginTop: '2px' }}>of {allPendingTotal.toFixed(0)} AED total</div>}
          </div>
        </div>
      </div>

      {/* ============ MONTH QUICK-JUMP BAR ============ */}
      {/* Clicking a month sets the date range filter to that whole month.
          Uses last-day calculation so Feb/Apr/etc. work correctly. */}
      {(() => {
        const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentYearNum = new Date().getFullYear();
        // Try to detect the active month from the current dateFrom
        const activeYear = dateFrom ? parseInt(dateFrom.slice(0, 4)) : currentYearNum;
        const activeMonth = dateFrom ? parseInt(dateFrom.slice(5, 7)) - 1 : -1;
        const yearsToShow = [];
        for (let y = currentYearNum - 2; y <= currentYearNum + 1; y++) yearsToShow.push(y);
        const jumpToMonth = (y, m) => {
          const lastDay = new Date(y, m + 1, 0).getDate();
          setDateFrom(`${y}-${String(m + 1).padStart(2, '0')}-01`);
          setDateTo(`${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
        };
        return (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', background: 'white', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${colors.border}` }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: colors.ink + '99', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>⚡ Jump to month:</span>
            <select
              value={activeYear}
              onChange={e => {
                const newYear = parseInt(e.target.value);
                if (activeMonth >= 0) jumpToMonth(newYear, activeMonth);
              }}
              style={{ padding: '5px 8px', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '12px', background: colors.soft + '55', fontWeight: 600, cursor: 'pointer' }}
            >
              {yearsToShow.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
              {monthsShort.map((m, idx) => {
                const isActive = activeMonth === idx;
                return (
                  <button
                    key={m}
                    onClick={() => jumpToMonth(activeYear, idx)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${isActive ? colors.headerGreen : colors.border}`,
                      background: isActive ? colors.headerGreen : 'white',
                      color: isActive ? 'white' : colors.ink,
                    }}
                  >{m}</button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Search & date filter bar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', background: 'white', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${colors.border}` }}>
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.ink + '77' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by client, cleaner, location or phone…"
            style={{ width: '100%', padding: '9px 12px 9px 36px', border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '13px', background: colors.soft + '55', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', color: colors.ink + '99', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <CalendarDays size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
            From:
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '13px', background: colors.soft + '55', outline: 'none' }}
          />
          <label style={{ fontSize: '12px', color: colors.ink + '99', fontWeight: 600, whiteSpace: 'nowrap' }}>To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ padding: '8px 10px', border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '13px', background: colors.soft + '55', outline: 'none' }}
          />
        </div>
        {isFiltered && (
          <button
            onClick={clearFilters}
            style={{ padding: '8px 14px', border: `1px solid ${colors.border}`, background: 'white', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color: colors.ink + 'CC', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
            title="Clear all filters"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {pending.length === 0 ? (
        isFiltered ? (
          <div style={{ background: 'white', borderRadius: '12px', border: `1px dashed ${colors.border}`, padding: '50px 20px', textAlign: 'center' }}>
            <Search size={40} style={{ color: colors.ink + '55', marginBottom: '12px' }} />
            <h3 className="display-font" style={{ margin: '0 0 6px', color: colors.ink, fontSize: '20px', fontWeight: 700 }}>No matches found</h3>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: colors.ink + '99' }}>
              Try a different search term{(dateFrom || dateTo) ? ` or a different date range` : ''}.
            </p>
            <button onClick={clearFilters} className="btn btn-primary btn-sm"><X size={12} /> Clear filters</button>
          </div>
        ) : (
          <div style={{ background: colors.accentLight, borderRadius: '12px', border: `1px solid ${colors.accent}33`, padding: '50px 20px', textAlign: 'center' }}>
            <Check size={48} style={{ color: colors.accent, marginBottom: '12px' }} />
            <h3 className="display-font" style={{ margin: '0 0 6px', color: colors.accent, fontSize: '22px', fontWeight: 700 }}>All paid up!</h3>
            <p style={{ margin: 0, fontSize: '13px', color: colors.ink + '99' }}>No outstanding payments. Mark jobs as PENDING in the bookings tab to track them here.</p>
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {groups.map(g => {
            const credit = clientCredits[g.name];
            const creditBalance = credit ? credit.balance : 0;
            return (
            <div key={g.name} style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', background: colors.soft, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div className="display-font" style={{ fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {g.name}
                    {creditBalance > 0 && (
                      <span title={`Client credit balance from overpayments — will offset ${creditBalance.toFixed(2)} AED next payment`} style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '99px', background: '#DBEAFE', color: '#1E40AF', letterSpacing: '0.03em' }}>
                        + {creditBalance.toFixed(0)} AED CREDIT
                      </span>
                    )}
                    {creditBalance < 0 && (
                      <span title={`Client owes ${Math.abs(creditBalance).toFixed(2)} AED extra from previous underpayments`} style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '99px', background: '#FEE2E2', color: '#991B1B', letterSpacing: '0.03em' }}>
                        − {Math.abs(creditBalance).toFixed(0)} AED DEBT
                      </span>
                    )}
                  </div>
                  {g.phone && <div style={{ fontSize: '12px', color: colors.ink + 'AA', marginTop: '2px' }}><Phone size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> <span className="mono">{g.phone}</span></div>}
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: colors.ink + '99', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{g.daysList.length} {g.daysList.length === 1 ? 'day' : 'days'} · {g.jobCount} {g.jobCount === 1 ? 'job' : 'jobs'}</div>
                    <div className="display-font" style={{ fontSize: '20px', fontWeight: 700, color: colors.warning }}>{g.total.toFixed(0)} AED owed</div>
                  </div>
                  <button
                    onClick={() => openPayModalForClient(g)}
                    className="btn btn-primary"
                    style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    title={`Mark all ${g.jobCount} pending jobs for ${g.name} (across ${g.daysList.length} ${g.daysList.length === 1 ? 'day' : 'days'}) as paid in one action`}
                  >
                    <Check size={12} /> Mark ALL {g.jobCount} Paid
                  </button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <tbody>
                    {g.daysList.map(day => {
                      const overdue = daysOverdue(day.date);
                      const dayKey = g.name + '__' + day.date;
                      const isExpanded = expanded.has(dayKey);
                      const cleanersArr = Array.from(day.cleaners);
                      const paymentTypesArr = Array.from(day.paymentTypes);
                      const locationsArr = Array.from(day.locations);
                      const canExpand = day.items.length > 1;
                      return (
                        <React.Fragment key={dayKey}>
                          <tr style={{ borderTop: `1px solid ${colors.border}`, cursor: canExpand ? 'pointer' : 'default' }} onClick={() => canExpand && toggleExpand(dayKey)}>
                            <td style={{ padding: '12px 18px', width: '160px', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {canExpand
                                  ? <ChevronRight size={14} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: colors.ink + '99' }} />
                                  : <span style={{ width: '14px' }} />}
                                {formatDateShort(day.date)}
                              </div>
                              {overdue > 0 && <div style={{ fontSize: '11px', color: overdue > 7 ? colors.rust : colors.warning, fontWeight: 600, marginLeft: '20px' }}>{overdue}d overdue</div>}
                            </td>
                            <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {cleanersArr.map(c => <span key={c} className="badge" style={{ background: colors.soft }}>{c}</span>)}
                              </div>
                              {locationsArr.length > 0 && (
                                <div style={{ fontSize: '11px', color: colors.ink + '88', marginTop: '4px' }}>
                                  <MapPin size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
                                  {locationsArr.slice(0, 2).join(' · ')}{locationsArr.length > 2 ? ` (+${locationsArr.length - 2})` : ''}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 10px', fontSize: '12px', color: colors.ink + '99', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                              {day.items.length} {day.items.length === 1 ? 'job' : 'jobs'}
                            </td>
                            <td style={{ padding: '12px 10px', textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                              {paymentTypesArr.map(pt => (
                                <span key={pt} className="badge" style={{ background: pt === 'CASH' ? '#FEE2E2' : colors.accentLight, color: pt === 'CASH' ? colors.rust : colors.accent, marginRight: '4px' }}>{pt}</span>
                              ))}
                            </td>
                            <td className="mono" style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 700, color: colors.warning, fontSize: '15px', verticalAlign: 'top' }}>{day.total.toFixed(0)}</td>
                            <td style={{ padding: '12px 18px', textAlign: 'right', verticalAlign: 'top' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={(e) => { e.stopPropagation(); openPayModalForDay(g.name, day); }}
                                title={canExpand ? `Record payment for all ${day.items.length} jobs` : 'Record payment'}
                              >
                                <Check size={12} /> {canExpand ? 'Mark Day Paid' : 'Mark Paid'}
                              </button>
                            </td>
                          </tr>

                          {isExpanded && canExpand && day.items.map(b => (
                            <tr key={b.id + '_detail'} style={{ background: colors.soft + '55', fontSize: '12px' }}>
                              <td style={{ padding: '8px 18px 8px 44px', color: colors.ink + '77', fontStyle: 'italic' }}>↳ detail</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span className="badge" style={{ background: 'white', border: `1px solid ${colors.border}` }}>{b.cleaner}</span>
                                <span className="mono" style={{ marginLeft: '8px', color: colors.ink + '99' }}>{b.timing}</span>
                              </td>
                              <td style={{ padding: '8px 10px', color: colors.ink + '77' }}>{b.location || '—'}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <span className="badge" style={{ background: b.paymentType === 'CASH' ? '#FEE2E2' : colors.accentLight, color: b.paymentType === 'CASH' ? colors.rust : colors.accent }}>{b.paymentType}</span>
                              </td>
                              <td className="mono" style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>{b.total.toFixed(0)}</td>
                              <td style={{ padding: '8px 18px', textAlign: 'right' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openPayModalForSingle(b); }}
                                  style={{ fontSize: '11px', padding: '4px 10px', background: 'white', border: `1px solid ${colors.border}`, borderRadius: '6px', cursor: 'pointer', color: colors.ink + 'CC' }}
                                  title="Record payment for only this cleaner's job"
                                >
                                  Mark this only
                                </button>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );})}
        </div>
      )}

      {/* Payment modal - CASH/ONLINE choice + amount received (for credit/debit tracking) */}
      {payModal && (
        <PaymentModal
          modal={payModal}
          onClose={() => setPayModal(null)}
          onConfirm={confirmPayment}
          currentCredit={clientCredits[payModal.clientName]?.balance || 0}
          colors={colors}
        />
      )}
    </div>
  );
}

// Popup that appears when clicking Mark Paid. Lets user pick CASH/ONLINE and enter actual amount received.
function PaymentModal({ modal, onClose, onConfirm, currentCredit, colors }) {
  const isBulk = modal.scope === 'client' || modal.scope === 'all';
  // For bulk with mixed payment types, default to "Keep original methods"
  const paymentTypesInSet = [...new Set((modal.items || []).map(i => i.paymentType || 'CASH'))];
  const hasMixedTypes = paymentTypesInSet.length > 1;
  const [paymentType, setPaymentType] = useState(modal.defaultType || 'CASH');
  const [keepOriginalMethod, setKeepOriginalMethod] = useState(isBulk && hasMixedTypes);
  const [amountReceived, setAmountReceived] = useState(String(modal.owedAmount));
  const owed = modal.owedAmount;
  const received = Number(amountReceived) || 0;
  const diff = received - owed;
  const dates = modal.dates || [];
  const dateLabel = dates.length === 1 ? dates[0] : `${dates.length} days (${dates[0]} → ${dates[dates.length - 1]})`;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '14px', padding: '24px', maxWidth: '480px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <h3 className="display-font" style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
              {isBulk ? '💼 Bulk Payment' : 'Record Payment'}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.ink + '99' }}>
              {modal.clientName} · {dateLabel}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: colors.ink + '99' }}>
            <X size={18} />
          </button>
        </div>

        {/* Bulk info banner */}
        {isBulk && (
          <div style={{ padding: '12px 14px', background: colors.gold + '33', border: `1px solid ${colors.gold}`, borderRadius: '8px', marginBottom: '14px', fontSize: '12px', color: colors.ink }}>
            <strong>⚡ Bulk action:</strong> You&apos;re about to mark <strong>{modal.items.length} jobs</strong> across <strong>{dates.length} {dates.length === 1 ? 'day' : 'days'}</strong>
            {modal.scope === 'client' ? ` for ${modal.clientName}` : ''}
            {modal.multiClient ? ` spanning ${modal.clientName}` : ''} as PAID in one action.
            {hasMixedTypes && (
              <div style={{ marginTop: '6px', fontSize: '11px', color: colors.ink + '99' }}>
                Payment types in this batch: {paymentTypesInSet.join(', ')} — recommend keeping originals.
              </div>
            )}
          </div>
        )}

        {currentCredit > 0 && !modal.multiClient && (
          <div style={{ padding: '10px 12px', background: '#DBEAFE', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', color: '#1E40AF' }}>
            💡 This client has <strong>{currentCredit.toFixed(2)} AED credit</strong> from previous overpayments. You can subtract it from the amount received below.
          </div>
        )}
        {currentCredit < 0 && !modal.multiClient && (
          <div style={{ padding: '10px 12px', background: '#FEE2E2', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', color: '#991B1B' }}>
            ⚠️ This client owes <strong>{Math.abs(currentCredit).toFixed(2)} AED extra</strong> from previous underpayments.
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
            <span style={{ color: colors.ink + '99' }}>Amount owed</span>
            <span className="mono" style={{ fontWeight: 700, color: colors.warning, fontSize: '16px' }}>{owed.toFixed(2)} AED</span>
          </div>
          <div style={{ fontSize: '11px', color: colors.ink + '77' }}>{modal.items.length} {modal.items.length === 1 ? 'job' : 'jobs'} being marked paid</div>
        </div>

        <label style={{ display: 'block', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.ink + '99', fontWeight: 600 }}>Payment method</div>
            {isBulk && (
              <label style={{ fontSize: '11px', color: colors.ink + '99', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={keepOriginalMethod}
                  onChange={e => setKeepOriginalMethod(e.target.checked)}
                  style={{ margin: 0, cursor: 'pointer' }}
                />
                Keep original methods
              </label>
            )}
          </div>
          {keepOriginalMethod ? (
            <div style={{ padding: '12px', border: `2px dashed ${colors.border}`, borderRadius: '10px', fontSize: '13px', color: colors.ink + '99', textAlign: 'center', background: colors.soft + '55' }}>
              Each job keeps its original payment method ({paymentTypesInSet.join(', ')})
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={() => setPaymentType('CASH')}
                style={{ padding: '12px', borderRadius: '10px', border: paymentType === 'CASH' ? `2px solid ${colors.rust}` : `2px solid ${colors.border}`, background: paymentType === 'CASH' ? '#FEE2E2' : 'white', color: paymentType === 'CASH' ? colors.rust : colors.ink, fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                💵 CASH
              </button>
              <button
                onClick={() => setPaymentType('ONLINE')}
                style={{ padding: '12px', borderRadius: '10px', border: paymentType === 'ONLINE' ? `2px solid ${colors.accent}` : `2px solid ${colors.border}`, background: paymentType === 'ONLINE' ? colors.accentLight : 'white', color: paymentType === 'ONLINE' ? colors.accent : colors.ink, fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                💳 ONLINE
              </button>
            </div>
          )}
        </label>

        <label style={{ display: 'block', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.ink + '99', fontWeight: 600, marginBottom: '6px' }}>Amount actually received (AED)</div>
          <input
            type="number"
            step="0.01"
            value={amountReceived}
            onChange={e => setAmountReceived(e.target.value)}
            style={{ width: '100%', padding: '12px', border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', outline: 'none' }}
            autoFocus
          />
          <div style={{ fontSize: '11px', color: colors.ink + '77', marginTop: '6px' }}>
            {modal.multiClient
              ? 'For multi-client bulk payments, over/underpayments are not tracked per client.'
              : 'Change if the client paid more or less than owed. Difference saved as credit/debt.'}
          </div>
        </label>

        {diff !== 0 && received > 0 && !modal.multiClient && (
          <div style={{ padding: '10px 12px', background: diff > 0 ? '#DCFCE7' : '#FEF3C7', borderRadius: '8px', marginBottom: '14px', fontSize: '13px', color: diff > 0 ? '#166534' : '#92400E' }}>
            {diff > 0 ? (
              <>✅ Overpayment of <strong>{diff.toFixed(2)} AED</strong> will be added as credit balance.</>
            ) : (
              <>⚠️ Underpayment of <strong>{Math.abs(diff).toFixed(2)} AED</strong> will be recorded as debt on the client's account.</>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 18px', border: `1px solid ${colors.border}`, background: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => onConfirm({ paymentType, amountReceived: Number(amountReceived), keepOriginalMethod })}
            className="btn btn-primary"
            style={{ padding: '10px 22px', fontSize: '13px' }}
            disabled={received <= 0}
          >
            <Check size={14} /> {isBulk ? `Confirm ${modal.items.length} Payments` : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeploymentView({ byCleaner, CLEANERS, date, formatDate, colors, printPage }) {
  const activeCleaners = CLEANERS.filter(c => byCleaner[c].length > 0);
  const displayCleaners = activeCleaners.length > 0 ? activeCleaners : CLEANERS.slice(0, 6);
  const maxJobs = Math.max(1, ...displayCleaners.map(c => byCleaner[c].length));

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Deployment Schedule</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>Print-ready grid by cleaner</p>
        </div>
        <button className="btn btn-primary" onClick={printPage}><Printer size={14} /> Print</button>
      </div>
      <div style={{ background: 'white', padding: '24px', borderRadius: '8px', border: `1px solid ${colors.border}` }}>
        <div style={{ background: colors.headerGreen, color: 'white', textAlign: 'center', padding: '14px', fontSize: '20px', fontWeight: 700, fontFamily: 'Fraunces, serif', border: `2px solid ${colors.ink}`, borderBottom: 'none' }}>Deployment — {formatDate(date)}</div>
        <table className="grid-table">
          <thead><tr>{displayCleaners.map(c => <th key={c} className="display-font">{c}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: maxJobs }).map((_, rowIdx) => (
              <tr key={rowIdx}>
                {displayCleaners.map(cleaner => {
                  const job = byCleaner[cleaner][rowIdx];
                  if (!job) return <td key={cleaner} className="deployment-cell" style={{ background: '#fafafa' }}></td>;
                  return (
                    <td key={cleaner} className="deployment-cell" style={{ background: job.withMaterials ? colors.cellMaterials : 'white' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '3px' }}>{job.clientName}</div>
                      <div style={{ fontSize: '11px', lineHeight: '1.4' }}>{job.location}</div>
                      {job.withMaterials && <div style={{ fontSize: '10px', color: colors.accent, fontWeight: 700, marginTop: '3px' }}>w/ materials</div>}
                      <div className="mono" style={{ fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>{job.timing}</div>
                      <div className="mono" style={{ fontSize: '12px', fontWeight: 700, color: colors.priceRed, marginTop: '3px' }}>({job.total.toFixed(0)} AED/{job.paymentType === 'CASH' ? 'C' : 'O'})</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '16px', fontSize: '11px', color: colors.ink + '99', display: 'flex', gap: '20px' }}>
          <span><span style={{ display: 'inline-block', width: '12px', height: '12px', background: colors.cellMaterials, marginRight: '4px', verticalAlign: 'middle', border: '1px solid #ccc' }}></span> With materials</span>
          <span>O = Online · C = Cash</span>
        </div>
      </div>
    </div>
  );
}

function ReportView({ bookingsWithCalc, date, formatDate, colors, totalRevenue, totalHours, cashTotal, onlineTotal, printPage, exportCSV, exportDailyReportExcel }) {
  const dayNum = new Date(date).getDate();
  const paidTotal = bookingsWithCalc.filter(b => b.paymentStatus === 'PAID').reduce((s, b) => s + b.total, 0);
  const pendingTotal = bookingsWithCalc.filter(b => b.paymentStatus !== 'PAID').reduce((s, b) => s + b.total, 0);

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Daily Report</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>End-of-day summary</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" onClick={exportCSV}><Download size={14} /> CSV</button>
          <button className="btn btn-primary" onClick={exportDailyReportExcel}><FileSpreadsheet size={14} /> Excel</button>
          <button className="btn" onClick={printPage}><Printer size={14} /> Print</button>
        </div>
      </div>
      <div style={{ background: 'white', padding: '32px', borderRadius: '8px', border: `1px solid ${colors.border}` }}>
        <div style={{ marginBottom: '24px', borderBottom: `2px solid ${colors.ink}`, paddingBottom: '16px' }}>
          <h1 className="display-font" style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: colors.accent }}>Daily Operations Report</h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px' }}>{formatDate(date)}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          <SummaryBox label="Total Jobs" value={bookingsWithCalc.length} colors={colors} />
          <SummaryBox label="Total Hours" value={totalHours.toFixed(1)} colors={colors} />
          <SummaryBox label="Cash" value={`${cashTotal.toFixed(0)} AED`} colors={colors} />
          <SummaryBox label="Online" value={`${onlineTotal.toFixed(0)} AED`} colors={colors} />
          <SummaryBox label="Paid" value={`${paidTotal.toFixed(0)} AED`} colors={colors} highlight />
          <SummaryBox label="Pending" value={`${pendingTotal.toFixed(0)} AED`} colors={colors} warning={pendingTotal > 0} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', border: `1px solid ${colors.ink}` }}>
            <thead>
              <tr style={{ background: '#FFF59D' }}>
                <ReportTh>DATE</ReportTh><ReportTh>CLEANER</ReportTh><ReportTh>TIMINGS</ReportTh>
                <ReportTh>CLIENT</ReportTh><ReportTh>LOCATION</ReportTh><ReportTh>MAT.</ReportTh>
                <ReportTh>HRS</ReportTh><ReportTh>RATE</ReportTh><ReportTh>TOTAL</ReportTh>
                <ReportTh>PAY</ReportTh><ReportTh>STATUS</ReportTh>
              </tr>
            </thead>
            <tbody>
              {bookingsWithCalc.map((b, i) => (
                <tr key={b.id} style={{ background: i % 2 === 0 ? '#FFFEF5' : 'white' }}>
                  <ReportTd>{dayNum}</ReportTd>
                  <ReportTd style={{ fontWeight: 600 }}>{b.cleaner}</ReportTd>
                  <ReportTd className="mono">{b.timing}</ReportTd>
                  <ReportTd>{b.clientName}</ReportTd>
                  <ReportTd>{b.location}</ReportTd>
                  <ReportTd style={{ textAlign: 'center' }}>{b.withMaterials ? 'Yes' : 'No'}</ReportTd>
                  <ReportTd className="mono" style={{ textAlign: 'center' }}>{b.hours}</ReportTd>
                  <ReportTd className="mono" style={{ textAlign: 'right' }}>{b.pricePerHour}</ReportTd>
                  <ReportTd className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{b.total.toFixed(2)}</ReportTd>
                  <ReportTd style={{ fontWeight: 600, color: b.paymentType === 'CASH' ? colors.rust : colors.accent }}>{b.paymentType}</ReportTd>
                  <ReportTd style={{ fontWeight: 600, color: b.paymentStatus === 'PAID' ? colors.accent : colors.warning }}>{b.paymentStatus || 'PENDING'}</ReportTd>
                </tr>
              ))}
              <tr style={{ background: colors.soft, fontWeight: 700 }}>
                <ReportTd colSpan="6" style={{ textAlign: 'right' }}>TOTAL</ReportTd>
                <ReportTd className="mono" style={{ textAlign: 'center' }}>{totalHours.toFixed(1)}</ReportTd>
                <ReportTd></ReportTd>
                <ReportTd className="mono" style={{ textAlign: 'right', color: colors.accent, fontSize: '14px' }}>{totalRevenue.toFixed(2)}</ReportTd>
                <ReportTd colSpan="2"></ReportTd>
              </tr>
            </tbody>
          </table>
        </div>
        {bookingsWithCalc.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: colors.ink + '66' }}>No bookings yet.</div>}
      </div>
    </div>
  );
}



function DriverView({ bookingsWithCalc, date, formatDate, colors, cleanerHomes, saveCleanerHomes, officeAddress, saveOfficeAddress, CLEANER_COLORS, CLEANERS, updateBooking }) {
  const [showSetup, setShowSetup] = React.useState(false);
  const mapRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const markersLayerRef = React.useRef(null);
  const [geocodingStatus, setGeocodingStatus] = React.useState('');

  // Build the driver's run schedule
  // Sort bookings by start time
  const parseStartTime = (timing) => {
    if (!timing) return 999;
    const m = timing.replace(/\s/g, '').match(/(\d+)(?::(\d+))?/);
    if (!m) return 999;
    let h = parseInt(m[1]);
    const mn = parseInt(m[2] || 0);
    return h + mn / 60;
  };
  const parseEndTime = (timing) => {
    if (!timing) return 999;
    const m = timing.replace(/\s/g, '').match(/-(\d+)(?::(\d+))?/);
    if (!m) return 999;
    let h = parseInt(m[1]);
    const mn = parseInt(m[2] || 0);
    const start = parseStartTime(timing);
    if (h < start) h += 12;
    return h + mn / 60;
  };

  const sorted = [...bookingsWithCalc].filter(b => b.location).sort((a, b) =>
    parseStartTime(a.timing) - parseStartTime(b.timing)
  );

  // Build the run: pickup events + drop-off events
  // Group by cleaner to figure out pickup origin
  const cleanerBookings = {};
  CLEANERS.forEach(c => cleanerBookings[c] = []);
  sorted.forEach(b => { if (cleanerBookings[b.cleaner]) cleanerBookings[b.cleaner].push(b); });

  const runEvents = [];
  CLEANERS.forEach(cleaner => {
    const jobs = cleanerBookings[cleaner].sort((a, b) => parseStartTime(a.timing) - parseStartTime(b.timing));
    if (jobs.length === 0) return;
    jobs.forEach((job, idx) => {
      // Pickup origin
      let originLabel, originAddress;
      if (idx === 0) {
        // First job — pickup from home or office based on booking
        if (job.pickupType === 'HOME') {
          originLabel = `${cleaner}'s home`;
          originAddress = cleanerHomes[cleaner]?.address || `${cleaner}'s home address (not set)`;
        } else {
          originLabel = 'Office';
          originAddress = officeAddress.address;
        }
      } else {
        // Subsequent job — coming from previous job location
        originLabel = `${cleaner} from ${jobs[idx - 1].clientName}`;
        originAddress = jobs[idx - 1].location;
      }
      runEvents.push({
        type: 'DROP',
        time: parseStartTime(job.timing),
        timeLabel: job.timing.split('-')[0] || job.timing,
        cleaner,
        clientName: job.clientName,
        location: job.location,
        phone: job.phone,
        originLabel,
        originAddress,
        bookingId: job.id,
        lat: job.lat,
        lng: job.lng
      });
    });
    // End-of-day pickup
    const lastJob = jobs[jobs.length - 1];
    runEvents.push({
      type: 'PICKUP',
      time: parseEndTime(lastJob.timing) + 0.001, // tiny offset for sort stability
      timeLabel: lastJob.timing.split('-')[1] || '',
      cleaner,
      clientName: lastJob.clientName,
      location: lastJob.location,
      phone: lastJob.phone,
      bookingId: lastJob.id,
      lat: lastJob.lat,
      lng: lastJob.lng
    });
  });
  runEvents.sort((a, b) => a.time - b.time);

  const formatTime = (t) => {
    const h = Math.floor(t);
    const m = Math.round((t - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const openInGoogleMaps = (location) => {
    const q = encodeURIComponent(location + ', Abu Dhabi, UAE');
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  };

  // Geocode addresses without coordinates using OpenStreetMap Nominatim (free, no API key)
  const geocodeAddress = async (address) => {
    try {
      const q = encodeURIComponent(address + ', Abu Dhabi, UAE');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`);
      const data = await res.json();
      if (data && data[0]) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (e) { console.error(e); }
    return null;
  };

  const geocodeAllMissing = async () => {
    setGeocodingStatus('Looking up addresses...');
    let count = 0;
    for (const b of bookingsWithCalc) {
      if ((!b.lat || !b.lng) && b.location) {
        const coords = await geocodeAddress(b.location);
        if (coords) {
          updateBooking(b.id, 'lat', coords.lat);
          updateBooking(b.id, 'lng', coords.lng);
          count++;
        }
        // Wait 1.1s between requests (Nominatim rate limit)
        await new Promise(r => setTimeout(r, 1100));
      }
    }
    setGeocodingStatus(`✓ Found ${count} location${count !== 1 ? 's' : ''}`);
    setTimeout(() => setGeocodingStatus(''), 3000);
  };

  // Initialize Leaflet map
  React.useEffect(() => {
    // Inject Leaflet CSS once
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    // Wait briefly for CSS, then init
    const initMap = async () => {
      const L = (await import('leaflet')).default;
      if (!mapRef.current || mapInstanceRef.current) return;
      // Default center: Abu Dhabi
      const map = L.map(mapRef.current).setView([24.4539, 54.3773], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(map);
      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
    };
    initMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when bookings change
  React.useEffect(() => {
    const updateMarkers = async () => {
      if (!mapInstanceRef.current || !markersLayerRef.current) return;
      const L = (await import('leaflet')).default;
      markersLayerRef.current.clearLayers();
      const points = [];

      // Add office marker
      if (officeAddress.lat && officeAddress.lng) {
        const officeIcon = L.divIcon({
          className: 'custom-marker',
          html: `<div style="background:#1A1A1A;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🏢</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
        L.marker([officeAddress.lat, officeAddress.lng], { icon: officeIcon })
          .bindPopup(`<b>Office</b><br>${officeAddress.address}`)
          .addTo(markersLayerRef.current);
        points.push([officeAddress.lat, officeAddress.lng]);
      }

      // Add booking markers
      bookingsWithCalc.forEach((b, idx) => {
        if (b.lat && b.lng) {
          const color = CLEANER_COLORS[b.cleaner] || '#0F4C3A';
          const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background:${color};color:white;width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);">
                     <span style="transform:rotate(45deg);font-size:11px;font-weight:700;">${b.cleaner.charAt(0)}</span>
                   </div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 36]
          });
          L.marker([b.lat, b.lng], { icon })
            .bindPopup(`
              <div style="font-family:sans-serif;min-width:200px;">
                <div style="font-weight:700;color:${color};font-size:14px;margin-bottom:4px;">${b.cleaner}</div>
                <div style="font-weight:600;font-size:13px;">${b.clientName}</div>
                <div style="font-size:11px;color:#666;margin:3px 0;">${b.location}</div>
                <div style="font-size:12px;font-weight:600;">⏰ ${b.timing}</div>
                ${b.phone ? `<div style="font-size:12px;margin-top:3px;">📞 ${b.phone}</div>` : ''}
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.location + ', Abu Dhabi, UAE')}" target="_blank" style="display:inline-block;margin-top:6px;padding:4px 8px;background:#0F4C3A;color:white;text-decoration:none;border-radius:4px;font-size:11px;font-weight:600;">📍 Open in Maps</a>
              </div>
            `)
            .addTo(markersLayerRef.current);
          points.push([b.lat, b.lng]);
        }
      });

      // Add cleaner home markers (only those with bookings today)
      const activeCleaners = new Set(bookingsWithCalc.filter(b => b.pickupType === 'HOME').map(b => b.cleaner));
      activeCleaners.forEach(cleaner => {
        const home = cleanerHomes[cleaner];
        if (home && home.lat && home.lng) {
          const color = CLEANER_COLORS[cleaner] || '#0F4C3A';
          const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background:white;border:3px solid ${color};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,0.3);">🏠</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
          L.marker([home.lat, home.lng], { icon })
            .bindPopup(`<b>${cleaner}'s home</b><br>${home.address}`)
            .addTo(markersLayerRef.current);
          points.push([home.lat, home.lng]);
        }
      });

      // Fit map to show all points
      if (points.length > 0) {
        mapInstanceRef.current.fitBounds(points, { padding: [40, 40], maxZoom: 13 });
      }
    };
    updateMarkers();
  }, [bookingsWithCalc, cleanerHomes, officeAddress]);

  const cleanersWithBookings = [...new Set(bookingsWithCalc.map(b => b.cleaner))];
  const bookingsWithoutCoords = bookingsWithCalc.filter(b => b.location && (!b.lat || !b.lng)).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Driver Schedule</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>{formatDate(date)} · {runEvents.length} stops</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setShowSetup(true)}>
            <Home size={14} /> Setup Addresses
          </button>
          {bookingsWithoutCoords > 0 && (
            <button className="btn btn-primary" onClick={geocodeAllMissing}>
              <MapPin size={14} /> Find {bookingsWithoutCoords} location{bookingsWithoutCoords > 1 ? 's' : ''} on map
            </button>
          )}
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {geocodingStatus && (
        <div style={{ padding: '10px 14px', background: colors.accentLight, border: `1px solid ${colors.accent}`, borderRadius: '8px', marginBottom: '16px', color: colors.accent, fontWeight: 600, fontSize: '13px' }}>
          {geocodingStatus}
        </div>
      )}

      {bookingsWithCalc.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', border: `1px dashed ${colors.border}`, padding: '60px 20px', textAlign: 'center', color: colors.ink + '99' }}>
          <Truck size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px' }}>No bookings for this day yet</h3>
          <p style={{ fontSize: '13px', margin: 0 }}>Add bookings on the Bookings tab to see the driver schedule.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="driver-grid">
          <style>{`
            @media (max-width: 900px) { .driver-grid { grid-template-columns: 1fr !important; } }
            @media print { .driver-grid { grid-template-columns: 1fr !important; } }
          `}</style>

          {/* MAP */}
          <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <h3 className="display-font" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>📍 Map</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px' }}>
                {cleanersWithBookings.map(c => (
                  <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: CLEANER_COLORS[c] || '#999' }}></span>
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div ref={mapRef} style={{ height: '500px', width: '100%', background: '#f0f0f0' }}></div>
            {bookingsWithoutCoords > 0 && (
              <div style={{ padding: '10px 16px', background: '#FEF3C7', fontSize: '12px', color: colors.warning, borderTop: `1px solid ${colors.border}` }}>
                ⚠️ {bookingsWithoutCoords} address{bookingsWithoutCoords > 1 ? 'es' : ''} not on map yet — click "Find locations on map" above
              </div>
            )}
          </div>

          {/* RUN LIST */}
          <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}` }}>
              <h3 className="display-font" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>🚐 Driver Run · sorted by time</h3>
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {runEvents.map((event, idx) => {
                const color = CLEANER_COLORS[event.cleaner] || '#0F4C3A';
                const isPickup = event.type === 'PICKUP';
                return (
                  <div key={idx} style={{
                    padding: '12px 16px',
                    borderBottom: idx < runEvents.length - 1 ? `1px solid ${colors.border}` : 'none',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    background: isPickup ? '#FFF8E7' : 'white'
                  }}>
                    <div style={{
                      flexShrink: 0,
                      width: '54px',
                      textAlign: 'center',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: colors.ink,
                      paddingTop: '2px'
                    }}>
                      {event.timeLabel}
                    </div>
                    <div style={{
                      flexShrink: 0,
                      width: '4px',
                      borderRadius: '2px',
                      background: color,
                      alignSelf: 'stretch',
                      minHeight: '40px'
                    }}></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '1px 8px',
                          borderRadius: '10px',
                          background: isPickup ? '#FEF3C7' : color,
                          color: isPickup ? colors.warning : 'white',
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {isPickup ? '🔄 Collect' : '📍 Drop'}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '14px', color }}>{event.cleaner}</span>
                      </div>
                      {!isPickup && (
                        <div style={{ fontSize: '12px', color: colors.ink + '99', marginBottom: '3px' }}>
                          From: <strong>{event.originLabel}</strong>
                          {event.originAddress && event.originAddress !== event.originLabel && (
                            <span style={{ color: colors.ink + '77' }}> · {event.originAddress}</span>
                          )}
                        </div>
                      )}
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>
                        {isPickup ? 'Pick up from: ' : 'To: '}
                        {event.clientName}
                      </div>
                      <div style={{ fontSize: '12px', color: colors.ink + 'AA', margin: '2px 0' }}>{event.location}</div>
                      {event.phone && (
                        <div style={{ fontSize: '11px', color: colors.ink + '99', display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '10px' }}>
                          <Phone size={11} /> <a href={`tel:${event.phone}`} style={{ color: colors.ink + '99', textDecoration: 'none' }}>{event.phone}</a>
                        </div>
                      )}
                      <button className="btn btn-sm" style={{ marginTop: '4px', padding: '4px 8px', fontSize: '11px' }} onClick={() => openInGoogleMaps(event.location)}>
                        <Navigation size={11} /> Open in Maps
                      </button>
                    </div>
                  </div>
                );
              })}
              {runEvents.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: colors.ink + '66', fontSize: '13px' }}>
                  No stops yet. Add bookings to build the driver run.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSetup && (
        <DriverSetupModal
          cleanerHomes={cleanerHomes}
          saveCleanerHomes={saveCleanerHomes}
          officeAddress={officeAddress}
          saveOfficeAddress={saveOfficeAddress}
          CLEANERS={CLEANERS}
          CLEANER_COLORS={CLEANER_COLORS}
          colors={colors}
          onClose={() => setShowSetup(false)}
        />
      )}
    </div>
  );
}

function DriverSetupModal({ cleanerHomes, saveCleanerHomes, officeAddress, saveOfficeAddress, CLEANERS, CLEANER_COLORS, colors, onClose }) {
  const [office, setOffice] = React.useState(officeAddress);
  const [homes, setHomes] = React.useState(cleanerHomes);
  const [geocoding, setGeocoding] = React.useState('');

  const geocode = async (address) => {
    try {
      const q = encodeURIComponent(address + ', Abu Dhabi, UAE');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`);
      const data = await res.json();
      if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch (e) {}
    return null;
  };

  const save = async () => {
    setGeocoding('Looking up addresses...');
    // Geocode office if address changed
    let updatedOffice = { ...office };
    if (office.address && office.address !== officeAddress.address) {
      const c = await geocode(office.address);
      if (c) { updatedOffice.lat = c.lat; updatedOffice.lng = c.lng; }
    }
    saveOfficeAddress(updatedOffice);

    // Geocode each home that changed
    const updatedHomes = { ...homes };
    for (const cleaner of CLEANERS) {
      const h = updatedHomes[cleaner];
      if (h && h.address) {
        const oldH = cleanerHomes[cleaner];
        if (!oldH || oldH.address !== h.address) {
          const c = await geocode(h.address);
          if (c) { h.lat = c.lat; h.lng = c.lng; }
          await new Promise(r => setTimeout(r, 1100));
        }
      }
    }
    saveCleanerHomes(updatedHomes);
    setGeocoding('✓ Saved');
    setTimeout(() => onClose(), 600);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 className="display-font" style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Setup Addresses</h3>
          <button className="btn btn-sm" onClick={onClose} style={{ padding: '6px' }}><X size={14} /></button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '13px', color: colors.ink + '99' }}>
          Set the office address and each cleaner's home address. Used by the driver to know where to pick up cleaners in the morning.
        </p>

        <div style={{ marginBottom: '20px' }}>
          <h4 className="display-font" style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={16} /> Office
          </h4>
          <input className="input" placeholder="Office address, area, Abu Dhabi" value={office.address || ''} onChange={e => setOffice({ ...office, address: e.target.value })} />
        </div>

        <div>
          <h4 className="display-font" style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Home size={16} /> Cleaners' Homes
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {CLEANERS.map(cleaner => (
              <div key={cleaner} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{
                  flexShrink: 0,
                  width: '90px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: CLEANER_COLORS[cleaner] }}></span>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{cleaner}</span>
                </div>
                <input
                  className="input"
                  placeholder="Home address (optional, only if pickup is from home)"
                  value={homes[cleaner]?.address || ''}
                  onChange={e => setHomes({ ...homes, [cleaner]: { ...(homes[cleaner] || {}), address: e.target.value } })}
                />
              </div>
            ))}
          </div>
        </div>

        {geocoding && (
          <div style={{ marginTop: '14px', padding: '8px 12px', background: colors.accentLight, color: colors.accent, borderRadius: '6px', fontSize: '13px', fontWeight: 600 }}>
            {geocoding}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}><Save size={14} /> Save All</button>
        </div>
      </div>
    </div>
  );
}

function MonthlyView({ allBookings, CLEANERS, colors, exportMonthlyExcel }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const monthName = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  // Use string prefix match ('YYYY-MM') to avoid the UTC/local-time bug that dropped
  // the 31st of the month in Abu Dhabi (UTC+4) — see also invoiceItems in InvoicesView.
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const filtered = allBookings.filter(b => b.date && b.date.startsWith(monthKey));

  const totalJobs = filtered.length;
  const totalHrs = filtered.reduce((s, b) => s + (b.hours || 0), 0);
  const totalRev = filtered.reduce((s, b) => s + (b.total || 0), 0);
  const cashTot = filtered.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + (b.total || 0), 0);
  const onlineTot = filtered.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + (b.total || 0), 0);
  const paidTot = filtered.filter(b => b.paymentStatus === 'PAID').reduce((s, b) => s + (b.total || 0), 0);
  const pendingTot = filtered.filter(b => b.paymentStatus !== 'PAID').reduce((s, b) => s + (b.total || 0), 0);
  const uniqueClients = new Set(filtered.map(b => b.clientName)).size;
  const activeDays = new Set(filtered.map(b => b.date)).size;

  // Per-cleaner breakdown
  const cleanerStats = CLEANERS.map(name => {
    const jobs = filtered.filter(b => b.cleaner === name);
    return {
      name, jobs: jobs.length,
      hours: jobs.reduce((s, b) => s + (b.hours || 0), 0),
      revenue: jobs.reduce((s, b) => s + (b.total || 0), 0)
    };
  }).filter(s => s.jobs > 0).sort((a, b) => b.revenue - a.revenue);

  // Per-day breakdown
  const dayMap = {};
  filtered.forEach(b => {
    if (!dayMap[b.date]) dayMap[b.date] = { date: b.date, jobs: 0, revenue: 0 };
    dayMap[b.date].jobs += 1;
    dayMap[b.date].revenue += (b.total || 0);
  });
  const dailyData = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const yearOptions = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) yearOptions.push(y);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Monthly Report</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>Complete monthly business record · ready to save to OneDrive/Drive</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="select" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: 'auto' }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {filtered.length > 0 && (
            <button className="btn btn-primary" onClick={() => exportMonthlyExcel(year, month)}>
              <FileSpreadsheet size={14} /> Download {months[month]} Excel
            </button>
          )}
        </div>
      </div>

      {/* ============ MONTH QUICK-JUMP BAR ============ */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', background: 'white', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${colors.border}` }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: colors.ink + '99', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>⚡ Jump to:</span>
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, idx) => {
            const isActive = month === idx;
            return (
              <button
                key={m}
                onClick={() => setMonth(idx)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${isActive ? colors.headerGreen : colors.border}`,
                  background: isActive ? colors.headerGreen : 'white',
                  color: isActive ? 'white' : colors.ink,
                }}
              >{m}</button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', border: `1px dashed ${colors.border}`, padding: '60px 20px', textAlign: 'center', color: colors.ink + '99' }}>
          <CalendarDays size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px' }}>No bookings recorded for {monthName}</h3>
          <p style={{ fontSize: '13px', margin: '0 0 16px' }}>Add bookings on the Bookings tab to see them here. Save your day to make sure data is recorded.</p>
        </div>
      ) : (
        <>
          {/* TOP STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <StatCard icon={<DollarSign size={18} />} label="Revenue" value={`${totalRev.toFixed(0)} AED`} color={colors.accent} colors={colors} />
            <StatCard icon={<Clock size={18} />} label="Hours" value={`${totalHrs.toFixed(1)}`} color={colors.gold} colors={colors} />
            <StatCard icon={<FileText size={18} />} label="Jobs" value={totalJobs} color={colors.rust} colors={colors} />
            <StatCard icon={<CalendarDays size={18} />} label="Active Days" value={activeDays} color={colors.ink} colors={colors} />
            <StatCard icon={<Users size={18} />} label="Clients" value={uniqueClients} color={colors.ink} colors={colors} />
          </div>

          {/* PAYMENT SUMMARY */}
          <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '20px', marginBottom: '20px' }}>
            <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>Payment Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <div style={{ padding: '12px', borderRadius: '8px', border: `1.5px solid ${colors.border}` }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: colors.ink + '99', fontWeight: 600 }}>Cash</div>
                <div className="display-font" style={{ fontSize: '20px', fontWeight: 700, color: colors.rust }}>{cashTot.toFixed(0)} AED</div>
              </div>
              <div style={{ padding: '12px', borderRadius: '8px', border: `1.5px solid ${colors.border}` }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: colors.ink + '99', fontWeight: 600 }}>Online</div>
                <div className="display-font" style={{ fontSize: '20px', fontWeight: 700, color: colors.accent }}>{onlineTot.toFixed(0)} AED</div>
              </div>
              <div style={{ padding: '12px', borderRadius: '8px', border: `1.5px solid ${colors.accent}`, background: colors.accentLight }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: colors.ink + '99', fontWeight: 600 }}>Paid</div>
                <div className="display-font" style={{ fontSize: '20px', fontWeight: 700, color: colors.accent }}>{paidTot.toFixed(0)} AED</div>
              </div>
              <div style={{ padding: '12px', borderRadius: '8px', border: `1.5px solid ${pendingTot > 0 ? colors.warning : colors.border}`, background: pendingTot > 0 ? '#FEF3C7' : 'transparent' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: colors.ink + '99', fontWeight: 600 }}>Pending</div>
                <div className="display-font" style={{ fontSize: '20px', fontWeight: 700, color: pendingTot > 0 ? colors.warning : colors.ink }}>{pendingTot.toFixed(0)} AED</div>
              </div>
            </div>
          </div>

          {/* BY CLEANER */}
          <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '20px', marginBottom: '20px' }}>
            <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>Performance by Cleaner</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: colors.soft }}>
                    <Th>Cleaner</Th><Th>Jobs</Th><Th>Hours</Th><Th>Revenue (AED)</Th><Th>Share</Th>
                  </tr>
                </thead>
                <tbody>
                  {cleanerStats.map(s => (
                    <tr key={s.name} style={{ borderTop: `1px solid ${colors.border}` }}>
                      <Td style={{ fontWeight: 600 }}>{s.name}</Td>
                      <Td>{s.jobs}</Td>
                      <Td className="mono">{s.hours.toFixed(1)}</Td>
                      <Td className="mono" style={{ fontWeight: 700, color: colors.accent }}>{s.revenue.toFixed(2)}</Td>
                      <Td>
                        <div style={{ background: colors.soft, height: '8px', borderRadius: '4px', width: '100px', overflow: 'hidden' }}>
                          <div style={{ width: `${(s.revenue / totalRev) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${colors.accent}, ${colors.gold})` }}></div>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DAILY BREAKDOWN */}
          <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '20px' }}>
            <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>Daily Breakdown</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: colors.soft }}>
                    <Th>Date</Th><Th>Day</Th><Th>Jobs</Th><Th>Revenue (AED)</Th>
                  </tr>
                </thead>
                <tbody>
                  {dailyData.map(d => (
                    <tr key={d.date} style={{ borderTop: `1px solid ${colors.border}` }}>
                      <Td className="mono">{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Td>
                      <Td>{new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })}</Td>
                      <Td>{d.jobs}</Td>
                      <Td className="mono" style={{ fontWeight: 700, color: colors.accent }}>{d.revenue.toFixed(2)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '16px', background: colors.accentLight, borderRadius: '10px', border: `1px solid ${colors.accent}33`, fontSize: '13px', color: colors.ink + 'CC' }}>
            <strong style={{ color: colors.accent }}>💡 Tip:</strong> Click "Download {monthName} Excel" above to get a professionally formatted Excel file with 6 sheets: Overview, Daily, All Jobs, By Cleaner, By Client, and Pending. Save it to OneDrive or Google Drive for access from any laptop.
          </div>
        </>
      )}
    </div>
  );
}

function InvoicesView({ allBookings, clients, companyInfo, saveCompanyInfo, colors, currentDate, currentBookings, savedDays }) {
  const [mode, setMode] = React.useState('monthly'); // monthly, daily, booking
  const [selectedClient, setSelectedClient] = React.useState('');
  const [clientSearchQuery, setClientSearchQuery] = React.useState('');
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth());
  const [selectedDate, setSelectedDate] = React.useState(now.toISOString().split('T')[0]);
  const [selectedBookings, setSelectedBookings] = React.useState([]); // array of booking IDs (multi-select)
  const [showPreview, setShowPreview] = React.useState(false);
  const [invoiceNotes, setInvoiceNotes] = React.useState('');

  // Get unique clients who have bookings
  const clientsWithBookings = React.useMemo(() => {
    const map = {};
    allBookings.forEach(b => {
      const key = b.clientName || 'Unknown';
      if (!map[key]) {
        const matched = clients.find(c => c.id === b.clientId) || {};
        map[key] = { name: key, address: b.location || matched.address || '', phone: b.phone || matched.phone || '', clientId: b.clientId };
      }
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [allBookings, clients]);

  // Filter the client list by search query (name, address, phone)
  const filteredClientsForPicker = React.useMemo(() => {
    const q = clientSearchQuery.trim().toLowerCase();
    if (!q) return clientsWithBookings;
    return clientsWithBookings.filter(c => {
      const blob = `${c.name || ''} ${c.address || ''} ${c.phone || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [clientsWithBookings, clientSearchQuery]);

  // Filter bookings based on mode
  const invoiceItems = React.useMemo(() => {
    if (!selectedClient) return [];
    if (mode === 'monthly') {
      // IMPORTANT: We compare dates as STRINGS ('YYYY-MM-DD') instead of Date objects,
      // because `new Date("YYYY-MM-DD")` treats the date as UTC midnight and then converts
      // to the local timezone. In Abu Dhabi (UTC+4), that would silently push the 31st of
      // any month back to the 30th (or the last day of February into January), causing the
      // last day of the month to be dropped from monthly invoices.
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`; // e.g. '2026-07'
      return allBookings.filter(b => {
        if (b.clientName !== selectedClient) return false;
        if (!b.date) return false;
        return b.date.startsWith(monthKey); // catches 2026-07-01 through 2026-07-31
      }).sort((a, b) => a.date.localeCompare(b.date));
    }
    if (mode === 'daily') {
      return allBookings.filter(b => b.clientName === selectedClient && b.date === selectedDate);
    }
    if (mode === 'booking') {
      const ids = selectedBookings.map(String);
      return allBookings.filter(b => b.clientName === selectedClient && ids.includes(String(b.id))).sort((a, b) => a.date.localeCompare(b.date) || (a.timing || '').localeCompare(b.timing || ''));
    }
    return [];
  }, [mode, selectedClient, year, month, selectedDate, selectedBookings, allBookings]);

  const subtotal = invoiceItems.reduce((s, b) => s + (b.total || 0), 0);
  const totalHours = invoiceItems.reduce((s, b) => s + (b.hours || 0), 0);

  // Analyze which days of the selected month have NOT been saved yet.
  // This catches the classic bug where the user forgets to click "Save Day" and
  // then generates a monthly invoice that's missing some of the days' work.
  const monthCoverage = React.useMemo(() => {
    if (mode !== 'monthly') return null;
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const isThisMonth = today.getFullYear() === year && today.getMonth() === month;
    // Only warn about days up to today (don't warn about future days in the current month)
    const lastDayToCheck = isThisMonth ? today.getDate() : daysInMonth;
    const unsavedDays = [];
    for (let d = 1; d <= lastDayToCheck; d++) {
      const dateStr = `${monthKey}-${String(d).padStart(2, '0')}`;
      if (!savedDays || !savedDays[dateStr]) {
        unsavedDays.push(dateStr);
      }
    }
    return { totalDays: lastDayToCheck, unsavedDays, isThisMonth };
  }, [mode, year, month, savedDays]);

  // Months
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const yearOptions = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) yearOptions.push(y);

  const clientBookings = selectedClient ? allBookings.filter(b => b.clientName === selectedClient).sort((a, b) => b.date.localeCompare(a.date)) : [];

  const generateInvoice = () => {
    if (invoiceItems.length === 0) { alert('No bookings to invoice. Pick a client with bookings.'); return; }
    setShowPreview(true);
  };

  const periodLabel = mode === 'monthly' ? `${months[month]} ${year}` : mode === 'daily' ? new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Single Booking';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Invoices</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>Generate professional invoices · download PDF · share via WhatsApp</p>
        </div>
        <div style={{ fontSize: '12px', color: colors.ink + 'AA', textAlign: 'right' }}>
          Next invoice #: <span className="mono" style={{ fontWeight: 700, color: colors.accent }}>{companyInfo.invoiceCounter}</span>
        </div>
      </div>

      {/* ============ UNSAVED-DAY WARNING BANNER ============ */}
      {/*
        A common cause of missing bookings on monthly invoices: the user enters
        bookings for a day but forgets to click "Save Day". The Deployment sheet
        and daily view show them (from live state), but the Invoice pulls only
        from `savedDays`. This banner catches that case and warns the user.
      */}
      {(() => {
        const hasUnsavedForToday = currentBookings && currentBookings.some(b => (b.clientName || b.location) && (b.timing || b.cleaner));
        const isDaySaved = savedDays && savedDays[currentDate];
        if (hasUnsavedForToday && !isDaySaved) {
          return (
            <div style={{ background: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <AlertCircle size={20} style={{ color: '#92400E', flexShrink: 0, marginTop: '1px' }} />
              <div style={{ flex: 1, fontSize: '13px', color: '#78350F' }}>
                <strong>Heads up:</strong> the bookings you have open for <strong>{currentDate}</strong> haven&apos;t been saved yet.
                They won&apos;t appear on invoices or monthly reports until you go back to the <strong>Bookings</strong> tab and click <strong>Save Day</strong>.
              </div>
            </div>
          );
        }
        return null;
      })()}

      <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '20px', marginBottom: '20px' }}>
        <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>1. Choose invoice type</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button className={`btn ${mode === 'monthly' ? 'btn-primary' : ''}`} onClick={() => setMode('monthly')}>
            <CalendarDays size={14} /> Monthly Invoice
          </button>
          <button className={`btn ${mode === 'daily' ? 'btn-primary' : ''}`} onClick={() => setMode('daily')}>
            <FileText size={14} /> Per-Day Invoice
          </button>
          <button className={`btn ${mode === 'booking' ? 'btn-primary' : ''}`} onClick={() => setMode('booking')}>
            <Receipt size={14} /> Single Booking Invoice
          </button>
        </div>

        <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>2. Pick the client</h3>
        <div style={{ marginBottom: '20px' }}>
          {clientsWithBookings.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: colors.ink + '66', fontSize: '13px' }}>
              No clients yet. Add bookings on the Bookings tab first.
            </div>
          ) : (
            <>
              {/* Search bar for the client list */}
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.ink + '77' }} />
                <input
                  type="text"
                  value={clientSearchQuery}
                  onChange={e => setClientSearchQuery(e.target.value)}
                  placeholder={`Search among ${clientsWithBookings.length} clients (name, address or phone)…`}
                  style={{ width: '100%', padding: '10px 12px 10px 38px', border: `1px solid ${colors.border}`, borderRadius: '8px', fontSize: '13px', background: colors.soft + '55', outline: 'none' }}
                />
                {clientSearchQuery && (
                  <button
                    onClick={() => setClientSearchQuery('')}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: colors.ink + '99' }}
                    title="Clear search"
                  ><X size={14} /></button>
                )}
              </div>

              {/* Selected client chip */}
              {selectedClient && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: colors.accentLight, border: `1.5px solid ${colors.accent}`, borderRadius: '8px', marginBottom: '10px' }}>
                  <Check size={16} style={{ color: colors.accent }} />
                  <div style={{ flex: 1, fontSize: '13px' }}>
                    Selected: <strong>{selectedClient}</strong>
                  </div>
                  <button
                    onClick={() => setSelectedClient('')}
                    style={{ padding: '4px 10px', background: 'white', border: `1px solid ${colors.border}`, borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                  >Change</button>
                </div>
              )}

              {/* Scrollable client list — only visible when no client is selected or search is active */}
              {(!selectedClient || clientSearchQuery) && (
                <div style={{ maxHeight: '260px', overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: '8px', background: 'white' }}>
                  {filteredClientsForPicker.length === 0 ? (
                    <div style={{ padding: '30px 20px', textAlign: 'center', color: colors.ink + '66', fontSize: '13px' }}>
                      No clients match “{clientSearchQuery}”
                    </div>
                  ) : (
                    filteredClientsForPicker.map(c => (
                      <button
                        key={c.name}
                        onClick={() => { setSelectedClient(c.name); setClientSearchQuery(''); }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                          background: selectedClient === c.name ? colors.accentLight : 'transparent',
                          border: 'none', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer', fontSize: '13px',
                          color: colors.ink,
                        }}
                        onMouseEnter={e => { if (selectedClient !== c.name) e.currentTarget.style.background = colors.soft + '99'; }}
                        onMouseLeave={e => { if (selectedClient !== c.name) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        {(c.address || c.phone) && (
                          <div style={{ fontSize: '11px', color: colors.ink + '99', marginTop: '2px' }}>
                            {c.address}{c.address && c.phone ? ' · ' : ''}{c.phone}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              <div style={{ fontSize: '11px', color: colors.ink + '77', marginTop: '6px' }}>
                {clientSearchQuery
                  ? `Showing ${filteredClientsForPicker.length} of ${clientsWithBookings.length} clients`
                  : `${clientsWithBookings.length} clients total`}
              </div>
            </>
          )}
        </div>

        {selectedClient && mode === 'monthly' && (
          <>
            <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>3. Pick the month</h3>
            {/* Quick-jump month buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="select" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: 'auto' }}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, idx) => {
                  const isActive = month === idx;
                  return (
                    <button
                      key={m}
                      onClick={() => setMonth(idx)}
                      style={{
                        padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${isActive ? colors.headerGreen : colors.border}`,
                        background: isActive ? colors.headerGreen : 'white',
                        color: isActive ? 'white' : colors.ink,
                      }}
                    >{m}</button>
                  );
                })}
              </div>
            </div>
            <div style={{ fontSize: '11px', color: colors.ink + '99', marginBottom: '20px' }}>
              Selected: <strong>{months[month]} {year}</strong>
            </div>
          </>
        )}

        {selectedClient && mode === 'daily' && (
          <>
            <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>3. Pick the date</h3>
            <input type="date" className="input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ width: 'auto', marginBottom: '20px' }} />
          </>
        )}

        {selectedClient && mode === 'booking' && (
          <>
            <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>3. Pick the booking(s)</h3>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: colors.ink + '99' }}>
              💡 Select one or more bookings to combine into a single invoice (e.g. when 2 cleaners worked on the same job).
            </p>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={() => setSelectedBookings(clientBookings.map(b => String(b.id)))}>
                <Check size={12} /> Select all
              </button>
              <button className="btn btn-sm" onClick={() => setSelectedBookings([])}>
                <X size={12} /> Clear
              </button>
              {(() => {
                // Group by date — show "Select today's all bookings" if multiple bookings same day
                const dateGroups = {};
                clientBookings.forEach(b => { dateGroups[b.date] = (dateGroups[b.date] || 0) + 1; });
                const multipleDates = Object.entries(dateGroups).filter(([_, count]) => count > 1);
                return multipleDates.map(([d, count]) => (
                  <button key={d} className="btn btn-sm" onClick={() => {
                    const dateBookings = clientBookings.filter(b => b.date === d).map(b => String(b.id));
                    setSelectedBookings(dateBookings);
                  }} style={{ background: colors.accentLight, borderColor: colors.accent, color: colors.accent }}>
                    📅 {new Date(d).toLocaleDateString('en-GB')} ({count} cleaners)
                  </button>
                ));
              })()}
            </div>
            <div style={{ border: `1px solid ${colors.border}`, borderRadius: '8px', maxHeight: '300px', overflowY: 'auto', marginBottom: '20px', background: 'white' }}>
              {clientBookings.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: colors.ink + '66', fontSize: '13px' }}>
                  No bookings yet for this client.
                </div>
              ) : clientBookings.map(b => {
                const isSelected = selectedBookings.includes(String(b.id));
                return (
                  <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer', background: isSelected ? colors.accentLight : 'white' }}>
                    <input type="checkbox" checked={isSelected} onChange={(e) => {
                      if (e.target.checked) setSelectedBookings([...selectedBookings, String(b.id)]);
                      else setSelectedBookings(selectedBookings.filter(id => id !== String(b.id)));
                    }} style={{ transform: 'scale(1.2)', cursor: 'pointer' }} />
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'auto auto auto 1fr auto', gap: '12px', alignItems: 'center', fontSize: '13px' }}>
                      <span className="mono" style={{ fontWeight: 600 }}>{new Date(b.date).toLocaleDateString('en-GB')}</span>
                      <span className="mono" style={{ color: colors.ink + 'AA' }}>{b.timing}</span>
                      <span style={{ fontWeight: 700, color: colors.accent }}>{b.cleaner}</span>
                      <span style={{ color: colors.ink + '99', fontSize: '12px' }}>{b.withMaterials ? '✓ Materials' : ''}</span>
                      <span className="mono" style={{ fontWeight: 700, color: colors.rust }}>{(b.total || 0).toFixed(2)} AED</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {selectedClient && (
          <>
            <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>4. Optional notes</h3>
            <textarea className="input" rows="2" placeholder="e.g. Thank you for your continued business" value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} style={{ resize: 'vertical', marginBottom: '20px' }} />

            {/* Warn if any days of the selected month are unsaved (root cause of "missing days" on invoices) */}
            {mode === 'monthly' && monthCoverage && monthCoverage.unsavedDays.length > 0 && (
              <div style={{ background: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: '10px', padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <AlertCircle size={20} style={{ color: '#92400E', flexShrink: 0, marginTop: '1px' }} />
                <div style={{ flex: 1, fontSize: '13px', color: '#78350F' }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ Some days in {months[month]} {year} haven&apos;t been saved</div>
                  <div style={{ fontSize: '12px', marginBottom: '6px' }}>
                    {monthCoverage.unsavedDays.length} of {monthCoverage.totalDays} day{monthCoverage.totalDays !== 1 ? 's' : ''} in this month {monthCoverage.unsavedDays.length === 1 ? 'has' : 'have'} no saved bookings.
                    If you had jobs on those days but forgot to click <strong>Save Day</strong>, they won&apos;t appear on this invoice.
                  </div>
                  <details style={{ fontSize: '11px' }}>
                    <summary style={{ cursor: 'pointer', color: '#78350F', fontWeight: 600 }}>Show unsaved dates ({monthCoverage.unsavedDays.length})</summary>
                    <div style={{ marginTop: '6px', fontFamily: 'monospace', lineHeight: 1.8 }}>
                      {monthCoverage.unsavedDays.map(d => {
                        const dayNum = parseInt(d.slice(8, 10), 10);
                        const dow = new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                        return <span key={d} style={{ display: 'inline-block', padding: '2px 8px', margin: '2px 4px 2px 0', background: 'white', borderRadius: '4px', border: '1px solid #F59E0B' }}>{dow} {dayNum}</span>;
                      })}
                    </div>
                    <div style={{ marginTop: '8px', color: '#78350F' }}>
                      To fix: open each date in the Bookings tab, check if bookings are there, then click <strong>Save Day</strong>.
                    </div>
                  </details>
                </div>
              </div>
            )}

            {invoiceItems.length > 0 && (
              <div style={{ background: colors.accentLight, border: `1.5px solid ${colors.accent}`, padding: '14px 18px', borderRadius: '10px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: colors.ink + 'AA', marginBottom: '2px' }}>Preview · {periodLabel}</div>
                    <div className="display-font" style={{ fontSize: '18px', fontWeight: 700 }}>{invoiceItems.length} job{invoiceItems.length > 1 ? 's' : ''} · {totalHours.toFixed(1)} hrs · <span style={{ color: colors.accent }}>{subtotal.toFixed(2)} AED</span></div>
                  </div>
                  <button className="btn btn-primary" onClick={generateInvoice}>
                    <Receipt size={14} /> Generate Invoice
                  </button>
                </div>
              </div>
            )}

            {selectedClient && invoiceItems.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: colors.ink + '66', fontSize: '13px', background: colors.soft, borderRadius: '8px' }}>
                No bookings found for this client in the selected period.
              </div>
            )}
          </>
        )}
      </div>

      {showPreview && (
        <InvoicePreviewModal
          items={invoiceItems}
          client={clientsWithBookings.find(c => c.name === selectedClient)}
          companyInfo={companyInfo}
          saveCompanyInfo={saveCompanyInfo}
          periodLabel={periodLabel}
          mode={mode}
          notes={invoiceNotes}
          colors={colors}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

function InvoicePreviewModal({ items, client, companyInfo, saveCompanyInfo, periodLabel, mode, notes, colors, onClose }) {
  const [invoiceNumber] = React.useState(companyInfo.invoiceCounter);
  const [committed, setCommitted] = React.useState(false);
  const printRef = React.useRef(null);

  React.useEffect(() => {
    // Increment invoice counter once when modal opens
    if (!committed) {
      saveCompanyInfo({ ...companyInfo, invoiceCounter: companyInfo.invoiceCounter + 1 });
      setCommitted(true);
    }
  }, []);

  const subtotal = items.reduce((s, b) => s + (b.total || 0), 0);
  const totalHours = items.reduce((s, b) => s + (b.hours || 0), 0);
  const today = new Date();
  const issueDate = today.toLocaleDateString('en-GB'); // dd/mm/yyyy
  const isPaid = items.every(b => b.paymentStatus === 'PAID');

  const titleByMode = {
    monthly: `MONTHLY SERVICE FOR ${periodLabel.toUpperCase()}`,
    daily: `CLEANING SERVICE - ${periodLabel.toUpperCase()}`,
    booking: 'CLEANING SERVICE'
  };

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=1100');
    win.document.write(`
      <!DOCTYPE html><html><head><title>Invoice ${invoiceNumber}</title>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; color: #1A1A1A; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: "Times New Roman", Georgia, serif; }
        * { box-sizing: border-box; }
        /* Force the invoice card to fill the A4 page cleanly */
        body > div { border: none !important; border-radius: 0 !important; box-shadow: none !important; }
      </style>
      </head><body>${printContent}<script>window.onload=()=>{setTimeout(()=>{window.print();window.onafterprint=()=>window.close();},250);}</script></body></html>
    `);
    win.document.close();
  };

  const buildWhatsAppMessage = () => {
    return `Hi ${client?.name || 'Customer'},\n\nHere is your invoice from ${companyInfo.name}:\n\nInvoice #: ${invoiceNumber}\nDate: ${issueDate}\nPeriod: ${periodLabel}\nTotal Hours: ${totalHours}\nAmount: AED ${subtotal.toFixed(2)}\n\n${isPaid ? 'Status: PAID ✓' : 'Please find payment details in the attached PDF.'}\n\nThank you for your business!\n\n${companyInfo.name}\n${companyInfo.phone}`;
  };

  const handleWhatsAppText = () => {
    const phone = (client?.phone || '').replace(/[^0-9]/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(buildWhatsAppMessage())}` : `https://wa.me/?text=${encodeURIComponent(buildWhatsAppMessage())}`;
    window.open(url, '_blank');
  };

  const handleSendWhatsAppPDF = () => {
    // Step 1: Trigger print-to-PDF
    handlePrint();
    // Step 2: After short delay, open WhatsApp with instruction message
    setTimeout(() => {
      const phone = (client?.phone || '').replace(/[^0-9]/g, '');
      const msg = buildWhatsAppMessage();
      const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      const confirmed = confirm(
        `📋 PDF download window is open.\n\n` +
        `Steps to send via WhatsApp:\n\n` +
        `1. In the print window, choose "Save as PDF" → Save to your device\n` +
        `2. Click OK below to open WhatsApp\n` +
        `3. In WhatsApp, tap the 📎 attachment icon\n` +
        `4. Choose "Document" → select the saved invoice PDF\n` +
        `5. Send!\n\n` +
        `Click OK to open WhatsApp now.`
      );
      if (confirmed) window.open(url, '_blank');
    }, 800);
  };

  // Build line items - one row per booking (now includes cleaner column for multi-cleaner invoices)
  // NOTE: We parse the day directly from the 'YYYY-MM-DD' string (not via `new Date()`),
  // because `new Date("2026-07-31").getDate()` returns 30 in UTC+4 zones like Abu Dhabi —
  // that's the bug that caused invoices to show only 30 days for July, August, etc.
  const lineItems = items.map(b => ({
    description: titleByMode[mode],
    date: b.date ? parseInt(b.date.slice(8, 10), 10) : '',
    timing: b.timing || '',
    hours: b.hours,
    rate: b.pricePerHour,
    materials: b.withMaterials ? 'Yes' : '',
    cleaner: b.cleaner,
    amount: b.total
  }));

  // Detect if this invoice has multiple cleaners (show "Cleaner" column)
  const cleanersInInvoice = [...new Set(items.map(b => b.cleaner))];
  const showCleanerColumn = cleanersInInvoice.length > 1 || mode === 'booking';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '95vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 className="display-font" style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Invoice Preview</h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button className="btn" onClick={handlePrint} title="Open print dialog — choose 'Save as PDF' to download">
              <Printer size={14} /> Print / Save PDF
            </button>
            <button className="btn" style={{ background: '#25D366', color: 'white', borderColor: '#25D366' }} onClick={handleSendWhatsAppPDF} title="Save PDF + open WhatsApp to send (with instructions)">
              <MessageCircle size={14} /> Send via WhatsApp + PDF
            </button>
            <button className="btn" onClick={handleWhatsAppText} title="Open WhatsApp with text message only (no PDF)">
              <MessageCircle size={14} /> Text only
            </button>
            <button className="btn btn-sm" onClick={onClose} style={{ padding: '6px' }}><X size={14} /></button>
          </div>
        </div>

        <div ref={printRef}>
          <InvoiceContent
            invoiceNumber={invoiceNumber}
            issueDate={issueDate}
            client={client}
            companyInfo={companyInfo}
            lineItems={lineItems}
            subtotal={subtotal}
            totalHours={totalHours}
            isPaid={isPaid}
            notes={notes}
            mode={mode}
            periodLabel={periodLabel}
            showCleanerColumn={showCleanerColumn}
            cleanersInInvoice={cleanersInInvoice}
          />
        </div>
      </div>
    </div>
  );
}

function InvoiceContent({ invoiceNumber, issueDate, client, companyInfo, lineItems, subtotal, totalHours, isPaid, notes, mode, periodLabel, showCleanerColumn, cleanersInInvoice }) {
  // Colour palette matching the branded PDF template
  const brand = {
    darkNavy: '#0A2E5C',      // top-left banner outer
    midBlue: '#1E5CAA',       // main brand blue (invoice title, table header, total)
    lightBlue: '#5B9BD5',     // thin divider lines and secondary accents
    teal: '#2AA79A',           // thank-you banner + footer strip
    softGrey: '#F5F5F5',      // alt row and light backgrounds
    darkText: '#1A1A1A',
    mutedText: '#666666',
    labelGrey: '#8E8E8E',
  };

  return (
    <div style={{ background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', position: 'relative', fontFamily: '"Times New Roman", Georgia, serif', color: brand.darkText, fontSize: '13px', width: '100%', maxWidth: '900px', margin: '0 auto', overflow: 'hidden', minHeight: '1240px', paddingBottom: '110px' }}>

      {/* ============ TOP DIAGONAL BLUE BANNER (top-left) ============ */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '55%', height: '90px', overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Outer dark navy diagonal */}
        <div style={{
          position: 'absolute', top: '-30px', left: '-30px', width: '100%', height: '90px',
          background: brand.darkNavy, transform: 'skewY(-8deg)', transformOrigin: 'top left',
        }} />
        {/* Inner mid blue diagonal, offset */}
        <div style={{
          position: 'absolute', top: '-15px', left: '-30px', width: '100%', height: '55px',
          background: brand.midBlue, transform: 'skewY(-8deg)', transformOrigin: 'top left',
        }} />
      </div>

      {/* ============ HEADER: logo + company name (top-right) ============ */}
      <div style={{ padding: '30px 40px 10px', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', minHeight: '110px', position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center' }}>
          {companyInfo.logoDataUrl
            ? <img src={companyInfo.logoDataUrl} alt="logo" style={{ maxHeight: '70px', display: 'block', marginLeft: 'auto', marginBottom: '6px' }} />
            : (
              // Placeholder logo swatch if the user hasn't uploaded a logo yet
              <div style={{ width: '160px', height: '54px', background: brand.midBlue, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: '13px', letterSpacing: '0.06em', marginLeft: 'auto', marginBottom: '6px' }}>
                {companyInfo.name?.toUpperCase() || 'YOUR LOGO'}
              </div>
            )}
          <div style={{ fontWeight: 700, fontSize: '13px', color: brand.midBlue }}>{companyInfo.name}</div>
          <div style={{ fontSize: '10px', color: brand.mutedText, maxWidth: '280px', margin: '2px 0 0', lineHeight: 1.4 }}>{companyInfo.address}</div>
          <div style={{ fontSize: '10px', color: brand.mutedText }}>
            {companyInfo.phone}{companyInfo.email ? ` | ${companyInfo.email}` : ''}
          </div>
          {companyInfo.trn && <div style={{ fontSize: '10px', color: brand.mutedText }}>TRN: {companyInfo.trn}</div>}
        </div>
      </div>

      {/* ============ INVOICE TITLE + first divider line ============ */}
      <div style={{ padding: '0 40px', position: 'relative', zIndex: 2 }}>
        <h1 style={{ margin: '10px 0 6px', fontSize: '26px', fontWeight: 400, color: brand.midBlue, letterSpacing: '0.08em', fontFamily: '"Times New Roman", Georgia, serif' }}>INVOICE</h1>
        <div style={{ height: '2px', background: brand.lightBlue, marginBottom: '20px' }} />
      </div>

      {/* PAID stamp (only if all bookings are paid) */}
      {isPaid && (
        <div style={{
          position: 'absolute', top: '180px', right: '60px',
          border: `4px solid ${brand.midBlue}`, color: brand.midBlue,
          padding: '6px 24px', fontSize: '30px', fontWeight: 800,
          letterSpacing: '0.1em', transform: 'rotate(-12deg)',
          opacity: 0.82, fontFamily: 'Arial, sans-serif', zIndex: 3,
        }}>
          PAID
        </div>
      )}

      {/* ============ BILL TO + DATE / INVOICE # ============ */}
      <div style={{ padding: '0 40px', display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '18px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: brand.labelGrey, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '3px' }}>Bill To</div>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px', fontFamily: 'Arial, sans-serif' }}>{client?.name}</div>
          <div style={{ fontSize: '12px', color: brand.darkText, lineHeight: 1.4 }}>{client?.address}</div>
          {client?.phone && <div style={{ fontSize: '12px', color: brand.mutedText }}>{client.phone}</div>}
          {showCleanerColumn && cleanersInInvoice && cleanersInInvoice.length > 1 && (
            <div style={{ fontSize: '11px', color: brand.mutedText, marginTop: '4px', fontStyle: 'italic' }}>
              Service performed by: {cleanersInInvoice.join(', ')}
            </div>
          )}
        </div>
        <div style={{ minWidth: '200px' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ padding: '3px 12px 3px 0', color: brand.labelGrey, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, fontSize: '10px' }}>Date</td>
                <td style={{ padding: '3px 0', fontWeight: 700, textAlign: 'right', fontFamily: 'Arial, sans-serif' }}>{issueDate}</td>
              </tr>
              <tr>
                <td style={{ padding: '3px 12px 3px 0', color: brand.labelGrey, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, fontSize: '10px' }}>Invoice #</td>
                <td style={{ padding: '3px 0', fontWeight: 700, textAlign: 'right', fontFamily: 'Arial, sans-serif', color: brand.midBlue }}>{invoiceNumber}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ============ LINE ITEMS TABLE ============ */}
      <div style={{ padding: '0 40px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: brand.midBlue, color: 'white' }}>
              <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Arial, sans-serif' }}>Description</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', width: '70px', fontFamily: 'Arial, sans-serif' }}>Job Date</th>
              {showCleanerColumn && <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', width: '85px', fontFamily: 'Arial, sans-serif' }}>Cleaner</th>}
              {mode === 'booking' && <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', width: '90px', fontFamily: 'Arial, sans-serif' }}>Time</th>}
              <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', width: '60px', fontFamily: 'Arial, sans-serif' }}>Hours</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', width: '70px', fontFamily: 'Arial, sans-serif' }}>Rate / hr</th>
              <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', width: '100px', fontFamily: 'Arial, sans-serif' }}>Amount (AED)</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? brand.softGrey : 'white' }}>
                <td style={{ padding: '9px 8px', verticalAlign: 'top' }}>
                  {idx === 0 ? <span style={{ fontWeight: 700, fontFamily: 'Arial, sans-serif' }}>{item.description}</span> : ''}
                </td>
                <td style={{ padding: '9px 8px', textAlign: 'center', verticalAlign: 'top' }}>{item.date}</td>
                {showCleanerColumn && <td style={{ padding: '9px 8px', textAlign: 'center', verticalAlign: 'top' }}>{item.cleaner}</td>}
                {mode === 'booking' && <td style={{ padding: '9px 8px', textAlign: 'center', verticalAlign: 'top', fontFamily: 'monospace', fontSize: '11px' }}>{item.timing}</td>}
                <td style={{ padding: '9px 8px', textAlign: 'center', verticalAlign: 'top' }}>{item.hours.toFixed(1)}</td>
                <td style={{ padding: '9px 8px', textAlign: 'center', verticalAlign: 'top' }}>{item.rate.toFixed(2)}</td>
                <td style={{ padding: '9px 8px', textAlign: 'right', verticalAlign: 'top' }}>{item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Thin blue divider before totals */}
        <div style={{ height: '1px', background: brand.lightBlue, marginBottom: '14px' }} />

        {/* ============ TOTAL DUE (right-aligned, brand blue) ============ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '12px', color: brand.mutedText }}>
            Total hours: <strong style={{ color: brand.darkText, fontFamily: 'Arial, sans-serif' }}>{totalHours.toFixed(1)}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: brand.labelGrey, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Total Due</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: brand.midBlue, marginTop: '3px', fontFamily: 'Arial, sans-serif' }}>AED {subtotal.toFixed(2)}</div>
          </div>
        </div>

        {/* Notes from user */}
        {notes && (
          <div style={{ background: '#EBF3FB', padding: '10px 14px', borderRadius: '4px', marginBottom: '14px', fontSize: '11px', color: '#333', borderLeft: `3px solid ${brand.midBlue}` }}>
            {notes}
          </div>
        )}

        {/* ============ THANK YOU banner (teal) ============ */}
        <div style={{ textAlign: 'center', padding: '20px 10px', fontWeight: 700, fontSize: '15px', color: brand.teal, letterSpacing: '0.15em', marginBottom: '14px', fontFamily: '"Times New Roman", Georgia, serif' }}>
          THANK YOU FOR YOUR BUSINESS!
        </div>

        {/* Thin blue divider */}
        <div style={{ height: '1px', background: brand.lightBlue, marginBottom: '18px' }} />

        {/* ============ BANK DETAILS + PAYMENT NOTES ============ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '20px', fontSize: '11px', lineHeight: 1.6 }}>
          <div>
            <div style={{ fontWeight: 700, color: brand.darkText, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px', fontFamily: 'Arial, sans-serif' }}>BANK DETAILS</div>
            <div style={{ fontWeight: 700 }}>{companyInfo.bankName}</div>
            <div>{companyInfo.bankBranch}</div>
            <div>Account No: {companyInfo.accountNo}</div>
            <div>IBAN: {companyInfo.iban}</div>
            <div>SWIFT: {companyInfo.swift}</div>
          </div>
          {companyInfo.bankNote && (
            <div>
              <div style={{ fontWeight: 700, color: brand.darkText, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px', fontFamily: 'Arial, sans-serif' }}>PAYMENT NOTES</div>
              <div style={{ whiteSpace: 'pre-line', color: brand.darkText }}>{companyInfo.bankNote}</div>
            </div>
          )}
        </div>
      </div>

      {/* ============ BOTTOM DIAGONAL BANNER + FOOTER ============ */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '95px', overflow: 'hidden', pointerEvents: 'none' }}>
        {/* Right teal diagonal (outer) */}
        <div style={{
          position: 'absolute', bottom: '-25px', right: '-40px', width: '65%', height: '85px',
          background: brand.darkNavy, transform: 'skewY(-8deg)', transformOrigin: 'bottom right',
        }} />
        {/* Inner mid blue */}
        <div style={{
          position: 'absolute', bottom: '-10px', right: '-40px', width: '65%', height: '55px',
          background: brand.midBlue, transform: 'skewY(-8deg)', transformOrigin: 'bottom right',
        }} />
      </div>

      {/* Footer content (contact info at bottom) */}
      <div style={{ position: 'absolute', bottom: '20px', left: '40px', right: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap', zIndex: 3, fontSize: '11px', color: brand.darkText, fontFamily: 'Arial, sans-serif', fontWeight: 600 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div>📞 +{companyInfo.phone?.replace(/^\+?/, '971 ') || '971 50 332 7215'}</div>
          <div>📍 {companyInfo.address}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'right', color: 'white' }}>
          {companyInfo.email && <div>✉ {companyInfo.email}</div>}
          <div>🌐 www.arhomeservices.ae</div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ companyInfo, saveCompanyInfo, colors, cloudStatus, lastSync, bookings, savedDays, clients, contracts, cleanerHomes, officeAddress, expenses, setCloudStatus, setLastSync }) {
  const [info, setInfo] = React.useState(companyInfo);
  const [savedMsg, setSavedMsg] = React.useState('');
  const [migrating, setMigrating] = React.useState(false);
  const [migrationLog, setMigrationLog] = React.useState([]);

  React.useEffect(() => { setInfo(companyInfo); }, [companyInfo]);

  const update = (field, value) => setInfo({ ...info, [field]: value });

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      alert('Logo too large. Max 200 KB please.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => update('logoDataUrl', ev.target.result);
    reader.readAsDataURL(file);
  };

  const save = () => {
    saveCompanyInfo(info);
    setSavedMsg('✓ Settings saved');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const pushAllToCloud = async () => {
    if (!confirm('This will push ALL your local data to the cloud, overwriting any existing cloud data. Continue?')) return;
    setMigrating(true);
    setMigrationLog([]);
    const log = (msg) => setMigrationLog(prev => [...prev, msg]);

    try {
      // 1. Push all saved days
      log('Pushing daily bookings...');
      const dayRows = Object.entries(savedDays).map(([date, d]) => ({
        date, bookings: d.bookings, saved_at: d.savedAt || new Date().toISOString()
      }));
      // Also include current day's bookings if not in savedDays
      const today = new Date().toISOString().split('T')[0];
      if (!savedDays[today] && bookings.length > 0 && bookings.some(b => b.clientName || b.location)) {
        dayRows.push({ date: today, bookings, saved_at: new Date().toISOString() });
      }
      if (dayRows.length > 0) {
        const { error } = await supabase.from('days').upsert(dayRows);
        if (error) throw error;
      }
      log(`✓ ${dayRows.length} day(s) synced`);

      // 2. Push clients
      log('Pushing clients...');
      if (clients.length > 0) {
        const rows = clients.map(c => ({
          id: c.id, name: c.name, phone: c.phone || '', address: c.address || '',
          default_rate: c.defaultRate || 25, default_materials: c.defaultMaterials || false,
          notes: c.notes || '', lat: c.lat || null, lng: c.lng || null
        }));
        const { error } = await supabase.from('clients').upsert(rows);
        if (error) throw error;
      }
      log(`✓ ${clients.length} client(s) synced`);

      // 3. Push contracts
      log('Pushing contracts...');
      if (contracts.length > 0) {
        const rows = contracts.map(c => ({
          id: c.id, client_id: c.clientId, client_name: c.clientName, cleaner: c.cleaner,
          days_of_week: c.daysOfWeek || [], timing: c.timing || '',
          price_per_hour: c.pricePerHour || 25, with_materials: c.withMaterials || false,
          payment_type: c.paymentType || 'ONLINE', active: c.active !== false,
          start_date: c.startDate || null
        }));
        const { error } = await supabase.from('contracts').upsert(rows);
        if (error) throw error;
      }
      log(`✓ ${contracts.length} contract(s) synced`);

      // 4. Push cleaner homes
      log('Pushing cleaner homes...');
      const homeRows = Object.entries(cleanerHomes).filter(([_, h]) => h && h.address).map(([cleaner, h]) => ({
        cleaner, address: h.address || '', lat: h.lat || null, lng: h.lng || null,
        updated_at: new Date().toISOString()
      }));
      if (homeRows.length > 0) {
        const { error } = await supabase.from('cleaner_homes').upsert(homeRows);
        if (error) throw error;
      }
      log(`✓ ${homeRows.length} cleaner home(s) synced`);

      // 5. Push office
      log('Pushing office address...');
      const { error: officeErr } = await supabase.from('office').upsert({
        id: 1, address: officeAddress.address || '', lat: officeAddress.lat || null, lng: officeAddress.lng || null,
        updated_at: new Date().toISOString()
      });
      if (officeErr) throw officeErr;
      log('✓ Office synced');

      // 6. Push company info
      log('Pushing company settings...');
      const { error: companyErr } = await supabase.from('company').upsert({
        id: 1, data: info, updated_at: new Date().toISOString()
      });
      if (companyErr) throw companyErr;
      log('✓ Company settings synced');

      // 7. Push expenses
      log('Pushing expenses...');
      if (expenses.length > 0) {
        const rows = expenses.map(e => ({
          id: e.id, date: e.date, category: e.category, amount: parseFloat(e.amount || 0),
          payment_method: e.paymentMethod, description: e.description || '',
          vendor: e.vendor || '', receipt: e.receipt || '', notes: e.notes || ''
        }));
        const { error } = await supabase.from('expenses').upsert(rows);
        if (error) throw error;
      }
      log(`✓ ${expenses.length} expense(s) synced`);

      log('🎉 ALL DATA SYNCED TO CLOUD!');
      setCloudStatus('synced');
      setLastSync(new Date());
    } catch (e) {
      console.error('Migration error:', e);
      log(`❌ Error: ${e.message || 'Sync failed'}`);
      setCloudStatus('offline');
    }
    setMigrating(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Settings</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>Your company info appears on every invoice</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {savedMsg && <span style={{ color: colors.accent, fontWeight: 600, fontSize: '13px' }}>{savedMsg}</span>}
          <button className="btn btn-primary" onClick={save}><Save size={14} /> Save Settings</button>
        </div>
      </div>

      {/* Cloud Sync Section */}
      <div style={{ background: 'white', borderRadius: '12px', border: `2px solid ${cloudStatus === 'synced' ? colors.accent : colors.border}`, padding: '20px', marginBottom: '16px' }}>
        <h3 className="display-font" style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cloud size={20} color={colors.accent} /> Cloud Sync
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: '12px', color: colors.ink + '99' }}>
          Your data is synced to Supabase cloud database. Changes sync automatically across all devices.
        </p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          <CloudSyncBadge status={cloudStatus} lastSync={lastSync} colors={colors} />
          {lastSync && <span style={{ fontSize: '12px', color: colors.ink + '99' }}>Last synced at {lastSync.toLocaleTimeString()}</span>}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={pushAllToCloud} disabled={migrating}>
            {migrating ? <><RefreshCw size={14} className="spin" /> Migrating...</> : <><Cloud size={14} /> Push all local data to cloud</>}
          </button>
          <button className="btn" onClick={() => window.location.reload()}>
            <RefreshCw size={14} /> Reload from cloud
          </button>
        </div>
        {migrationLog.length > 0 && (
          <div style={{ marginTop: '14px', padding: '12px', background: colors.soft, borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', maxHeight: '200px', overflowY: 'auto' }}>
            {migrationLog.map((line, i) => <div key={i} style={{ marginBottom: '2px' }}>{line}</div>)}
          </div>
        )}
        <p style={{ margin: '12px 0 0', fontSize: '11px', color: colors.ink + '99', fontStyle: 'italic' }}>
          💡 First-time setup: Click "Push all local data to cloud" to upload your existing bookings, clients, contracts, expenses, and settings. After that, every change syncs automatically.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '20px' }}>
          <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>Company Information</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Field label="Company Name *"><input className="input" value={info.name} onChange={e => update('name', e.target.value)} /></Field>
            <Field label="Address"><textarea className="input" rows="2" value={info.address} onChange={e => update('address', e.target.value)} style={{ resize: 'vertical' }} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Phone"><input className="input" value={info.phone} onChange={e => update('phone', e.target.value)} /></Field>
              <Field label="TRN (optional)"><input className="input" value={info.trn} onChange={e => update('trn', e.target.value)} /></Field>
            </div>
            <Field label="Email"><input className="input" value={info.email} onChange={e => update('email', e.target.value)} /></Field>
            <Field label="Logo (optional, max 200 KB)">
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ fontSize: '12px' }} />
              {info.logoDataUrl && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={info.logoDataUrl} alt="logo" style={{ maxHeight: '50px', border: `1px solid ${colors.border}`, padding: '4px', borderRadius: '4px', background: 'white' }} />
                  <button className="btn btn-danger btn-sm" onClick={() => update('logoDataUrl', '')}><Trash2 size={12} /> Remove</button>
                </div>
              )}
            </Field>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '20px' }}>
          <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>Bank Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Field label="Bank Account Holder"><input className="input" value={info.bankName} onChange={e => update('bankName', e.target.value)} /></Field>
            <Field label="Bank Name & Branch"><input className="input" value={info.bankBranch} onChange={e => update('bankBranch', e.target.value)} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="Account No."><input className="input" value={info.accountNo} onChange={e => update('accountNo', e.target.value)} /></Field>
              <Field label="SWIFT Code"><input className="input" value={info.swift} onChange={e => update('swift', e.target.value)} /></Field>
            </div>
            <Field label="IBAN"><input className="input" value={info.iban} onChange={e => update('iban', e.target.value)} /></Field>
            <Field label="Payment Notes (shown on invoice)">
              <textarea className="input" rows="3" value={info.bankNote} onChange={e => update('bankNote', e.target.value)} style={{ resize: 'vertical' }} />
            </Field>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '20px' }}>
          <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>Invoice Numbering</h3>
          <Field label="Next invoice number">
            <input className="input" type="number" value={info.invoiceCounter} onChange={e => update('invoiceCounter', parseInt(e.target.value) || 1)} />
            <div style={{ fontSize: '11px', color: colors.ink + '99', marginTop: '6px' }}>
              The next invoice you generate will be #{info.invoiceCounter}. After that it will auto-increment.
            </div>
          </Field>
        </div>
      </div>
    </div>
  );
}

function LocationPickerModal({ title, initialLat, initialLng, initialAddress, onSave, onClose, colors }) {
  const [lat, setLat] = React.useState(initialLat || 24.4539);
  const [lng, setLng] = React.useState(initialLng || 54.3773);
  const [address, setAddress] = React.useState(initialAddress || '');
  const [searching, setSearching] = React.useState(false);
  const mapRef = React.useRef(null);
  const mapInstanceRef = React.useRef(null);
  const markerRef = React.useRef(null);

  React.useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const initMap = async () => {
      const L = (await import('leaflet')).default;
      if (!mapRef.current || mapInstanceRef.current) return;
      const map = L.map(mapRef.current).setView([lat, lng], initialLat ? 16 : 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background:#0F4C3A;color:white;width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"><span style="transform:rotate(45deg);font-size:14px;">📍</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      });
      const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      marker.on('dragend', (e) => {
        const p = e.target.getLatLng();
        setLat(p.lat); setLng(p.lng);
      });
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        setLat(e.latlng.lat); setLng(e.latlng.lng);
      });
      mapInstanceRef.current = map;
      markerRef.current = marker;
    };
    initMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const searchAddress = async () => {
    if (!address.trim()) return;
    setSearching(true);
    try {
      const q = encodeURIComponent(address + ', Abu Dhabi, UAE');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`);
      const data = await res.json();
      if (data && data[0]) {
        const newLat = parseFloat(data[0].lat);
        const newLng = parseFloat(data[0].lon);
        setLat(newLat); setLng(newLng);
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([newLat, newLng], 16);
          markerRef.current.setLatLng([newLat, newLng]);
        }
      } else {
        alert('Location not found. Try a different address or click on the map directly.');
      }
    } catch (e) {
      alert('Search failed. Click on the map to pick the location manually.');
    }
    setSearching(false);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        setLat(newLat); setLng(newLng);
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([newLat, newLng], 17);
          markerRef.current.setLatLng([newLat, newLng]);
        }
      },
      () => alert('Could not get current location. Try clicking on the map directly.'),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 className="display-font" style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{title}</h3>
          <button className="btn btn-sm" onClick={onClose} style={{ padding: '6px' }}><X size={14} /></button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '12px', color: colors.ink + '99' }}>
          Search by address, use your current location, or click directly on the map. Drag the pin to fine-tune.
        </p>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <input className="input" placeholder="Enter address to search..." value={address} onChange={e => setAddress(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), searchAddress())} style={{ flex: 1, minWidth: '200px' }} />
          <button className="btn" onClick={searchAddress} disabled={searching}>
            <Search size={14} /> {searching ? 'Searching...' : 'Search'}
          </button>
          <button className="btn" onClick={useCurrentLocation}>
            <Navigation size={14} /> My location
          </button>
        </div>
        <div ref={mapRef} style={{ height: '400px', width: '100%', borderRadius: '8px', border: `1px solid ${colors.border}`, marginBottom: '10px' }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', color: colors.ink + 'AA' }}>
            <strong>Pinned:</strong> <span className="mono">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
          </div>
          <a href={`https://www.google.com/maps/?q=${lat},${lng}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: colors.accent, fontWeight: 600 }}>
            🗺️ Verify in Google Maps →
          </a>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(lat, lng, address)}><Check size={14} /> Save Pin</button>
        </div>
      </div>
    </div>
  );
}

function ExpensesView({ expenses, saveExpenses, colors, totalRevenue, bookingsWithCalc, allBookings, payroll, savePayroll, PAYROLL_ROSTER }) {
  const [editing, setEditing] = useState(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterCategory, setFilterCategory] = useState('');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const yearOptions = [];
  const now = new Date();
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) yearOptions.push(y);

  const emptyExpense = () => ({
    id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    date: new Date().toISOString().split('T')[0],
    category: 'Materials',
    amount: 0,
    paymentMethod: 'Cash',
    description: '',
    vendor: '',
    receipt: '',
    notes: ''
  });

  const startNew = () => setEditing(emptyExpense());
  const startEdit = (e) => setEditing({ ...e });

  const save = () => {
    if (!editing.amount || editing.amount <= 0) return alert('Enter a valid amount');
    if (!editing.category) return alert('Pick a category');
    const exists = expenses.find(e => e.id === editing.id);
    saveExpenses(exists ? expenses.map(e => e.id === editing.id ? editing : e) : [...expenses, editing]);
    setEditing(null);
  };

  const remove = (id) => { if (confirm('Delete this expense?')) saveExpenses(expenses.filter(e => e.id !== id)); };

  // Filter — use STRING prefix match to avoid timezone bug on 31-day months
  const monthKeyFilter = `${filterYear}-${String(filterMonth + 1).padStart(2, '0')}`;
  const filtered = expenses.filter(e => {
    if (!e.date || !e.date.startsWith(monthKeyFilter)) return false;
    if (filterCategory && e.category !== filterCategory) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const monthTotal = filtered.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  // ============ PAYROLL SUMMARY (pulls from Payroll tab data) ============
  // For the selected month, build one row per employee with:
  //   Base Salary | Bonuses (Incentive) | Deductions | Net Total
  // Grand total then adds "Other Expenses" (the regular expenses table) at the bottom.
  const payrollForMonth = (payroll && payroll[monthKeyFilter]) || {};
  const rosterList = PAYROLL_ROSTER || [];
  const payrollRows = rosterList.map(person => {
    const rec = payrollForMonth[person.name] || { salary: 0, bonuses: [], deductions: [] };
    const salary = Number(rec.salary || 0);
    const bonuses = (rec.bonuses || []).reduce((s, b) => s + Number(b.amount || 0), 0);
    const deductions = (rec.deductions || []).reduce((s, d) => s + Number(d.amount || 0), 0);
    const net = salary + bonuses - deductions;
    return { name: person.name, role: person.role, defaultSalary: person.defaultSalary, salary, bonuses, deductions, net };
  });
  const payrollTotalSalary = payrollRows.reduce((s, r) => s + r.salary, 0);
  const payrollTotalBonuses = payrollRows.reduce((s, r) => s + r.bonuses, 0);
  const payrollTotalDeductions = payrollRows.reduce((s, r) => s + r.deductions, 0);
  const payrollTotalNet = payrollRows.reduce((s, r) => s + r.net, 0);
  const grandTotal = payrollTotalNet + monthTotal;

  // Count how many people have a salary already set for this month
  const filledSalaries = payrollRows.filter(r => r.salary > 0).length;
  const allSalariesFilled = filledSalaries === rosterList.length && rosterList.length > 0;

  // ONE-CLICK: fill in every employee's default salary for the selected month.
  // Preserves any existing bonuses/deductions; only overwrites the base salary.
  const generateAllSalaries = () => {
    if (rosterList.length === 0) return;
    const msg = filledSalaries > 0
      ? `This will set default salaries for ${rosterList.length} employees for ${months[filterMonth]} ${filterYear}, overwriting any existing base salary values (bonuses & deductions will be preserved). Continue?`
      : `Set default salaries for ${rosterList.length} employees for ${months[filterMonth]} ${filterYear}?`;
    if (!confirm(msg)) return;
    const monthData = { ...(payroll[monthKeyFilter] || {}) };
    rosterList.forEach(person => {
      const existing = monthData[person.name] || { salary: 0, bonuses: [], deductions: [], attendance: {}, workingHours: 0, notes: '' };
      monthData[person.name] = { ...existing, salary: person.defaultSalary };
    });
    savePayroll({ ...payroll, [monthKeyFilter]: monthData });
  };



  // Calculate revenue for the same period
  const monthStart = new Date(filterYear, filterMonth, 1);
  const monthEnd = new Date(filterYear, filterMonth + 1, 0);
  const periodRevenue = allBookings.filter(b => {
    const d = new Date(b.date);
    return d >= monthStart && d <= monthEnd;
  }).reduce((s, b) => s + (b.total || 0), 0);
  const profit = periodRevenue - monthTotal;

  // Breakdown by category
  const byCategory = {};
  EXPENSE_CATEGORIES.forEach(cat => byCategory[cat] = 0);
  filtered.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + parseFloat(e.amount || 0); });
  const categoryList = Object.entries(byCategory).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  // Breakdown by payment method
  const byMethod = {};
  EXPENSE_PAYMENT_METHODS.forEach(m => byMethod[m] = 0);
  filtered.forEach(e => { byMethod[e.paymentMethod] = (byMethod[e.paymentMethod] || 0) + parseFloat(e.amount || 0); });

  const exportExpensesExcel = () => {
    const headers = ['DATE', 'CATEGORY', 'DESCRIPTION', 'VENDOR', 'PAYMENT METHOD', 'AMOUNT (AED)', 'NOTES'];
    const rows = filtered.map(e => [
      e.date, e.category, e.description || '', e.vendor || '', e.paymentMethod, Number(parseFloat(e.amount || 0).toFixed(2)), e.notes || ''
    ]);
    rows.push(['', '', '', '', 'TOTAL', Number(monthTotal.toFixed(2)), '']);

    const wb = XLSX.utils.book_new();

    // Style helpers (reuse pattern from main app)
    const greenHeader = {
      font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FF0F4C3A' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin', color: { rgb: 'FF1A1A1A' } }, bottom: { style: 'thin', color: { rgb: 'FF1A1A1A' } }, left: { style: 'thin', color: { rgb: 'FF1A1A1A' } }, right: { style: 'thin', color: { rgb: 'FF1A1A1A' } } }
    };
    const titleStyle = { ...greenHeader, font: { ...greenHeader.font, sz: 16 } };
    const cellStyle = {
      font: { name: 'Calibri', sz: 11, color: { rgb: 'FF1A1A1A' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin', color: { rgb: 'FFD4CFC0' } }, bottom: { style: 'thin', color: { rgb: 'FFD4CFC0' } }, left: { style: 'thin', color: { rgb: 'FFD4CFC0' } }, right: { style: 'thin', color: { rgb: 'FFD4CFC0' } } }
    };
    const altCellStyle = { ...cellStyle, fill: { patternType: 'solid', fgColor: { rgb: 'FFFAF8F3' } } };
    const totalStyle = {
      font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: 'FF0F4C3A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'medium', color: { rgb: 'FF1A1A1A' } }, bottom: { style: 'medium', color: { rgb: 'FF1A1A1A' } }, left: { style: 'thin', color: { rgb: 'FF1A1A1A' } }, right: { style: 'thin', color: { rgb: 'FF1A1A1A' } } }
    };

    const ws = {};
    const cols = headers.length;

    // Title row
    for (let c = 0; c < cols; c++) {
      ws[XLSX.utils.encode_cell({ r: 0, c })] = { v: c === 0 ? `EXPENSES — ${months[filterMonth]} ${filterYear}` : '', t: 's', s: titleStyle };
    }
    // Subtitle
    for (let c = 0; c < cols; c++) {
      ws[XLSX.utils.encode_cell({ r: 1, c })] = { v: c === 0 ? `${filtered.length} entries · ${monthTotal.toFixed(2)} AED total` : '', t: 's', s: { ...titleStyle, font: { ...titleStyle.font, sz: 11, italic: true } } };
    }
    // Headers row 3
    headers.forEach((h, c) => {
      ws[XLSX.utils.encode_cell({ r: 3, c })] = { v: h, t: 's', s: greenHeader };
    });
    // Data rows
    rows.forEach((row, rIdx) => {
      const r = rIdx + 4;
      const isTotalRow = rIdx === rows.length - 1;
      const alt = rIdx % 2 === 1;
      row.forEach((cell, c) => {
        const style = isTotalRow ? totalStyle : (alt ? altCellStyle : cellStyle);
        const isNumber = typeof cell === 'number';
        ws[XLSX.utils.encode_cell({ r, c })] = { v: cell, t: isNumber ? 'n' : 's', s: style };
      });
    });

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length + 3, c: cols - 1 } });
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: cols - 1 } }
    ];
    ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 28 }];
    ws['!rows'] = [{ hpt: 32 }, { hpt: 20 }, { hpt: 8 }, { hpt: 24 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, `expenses_${months[filterMonth]}_${filterYear}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Expenses</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>Track all business expenses · {expenses.length} total entries</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {filtered.length > 0 && <button className="btn" onClick={exportExpensesExcel}><FileSpreadsheet size={14} /> Excel</button>}
          <button className="btn btn-primary" onClick={startNew}><Plus size={14} /> New Expense</button>
        </div>
      </div>

      {/* ============ MONTHLY PAYROLL SUMMARY TABLE ============ */}
      {/* Rolls up salary + bonuses (incentives) − deductions per employee for the selected month.
          Data comes from the Payroll tab. If an employee has no record for the month, they show 0s.
          The GRAND TOTAL at the bottom includes both payroll AND "Other Expenses" for the same month. */}
      <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '20px', marginBottom: '20px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 className="display-font" style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Monthly Payroll Summary · {months[filterMonth]} {filterYear}</h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.ink + '99' }}>
              Salary + Incentives − Deductions per employee. {filledSalaries === 0 ? 'Click Generate to fill default salaries.' : `${filledSalaries} of ${rosterList.length} salaries set.`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {rosterList.length > 0 && (
              <button
                onClick={generateAllSalaries}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13px' }}
                title="One click fills every employee's default salary for this month"
              >
                <RefreshCw size={13} /> {allSalariesFilled ? 'Regenerate' : 'Generate'} All Salaries
              </button>
            )}
            <div style={{ padding: '6px 12px', background: colors.accentLight, border: `1px solid ${colors.accent}`, borderRadius: '8px', fontSize: '11px', color: colors.accent, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Users size={12} /> {rosterList.length} employees
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: colors.headerGreen, color: 'white' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '40px' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Employee Name</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Salary</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incentive</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deduction</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Total</th>
              </tr>
            </thead>
            <tbody>
              {payrollRows.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '30px 20px', textAlign: 'center', color: colors.ink + '66', fontSize: '13px', background: colors.soft }}>
                    No employees in the payroll roster yet.
                  </td>
                </tr>
              ) : payrollRows.map((r, idx) => (
                <tr key={r.name} style={{ background: idx % 2 === 0 ? colors.soft + '55' : 'white', borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: '10px 12px', color: colors.ink + '99', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 700, fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{r.name}</div>
                    {r.role && r.role !== 'Cleaner' && (
                      <div style={{ fontSize: '10px', color: colors.ink + '77', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.role}</div>
                    )}
                  </td>
                  <td className="mono" style={{ padding: '10px 12px', textAlign: 'right', color: r.salary === 0 ? colors.ink + '55' : colors.ink }}>
                    {r.salary.toFixed(0)} AED
                    {r.salary === 0 && r.defaultSalary && (
                      <div style={{ fontSize: '9px', color: colors.ink + '55', marginTop: '2px' }}>default: {r.defaultSalary}</div>
                    )}
                  </td>
                  <td className="mono" style={{ padding: '10px 12px', textAlign: 'right', color: r.bonuses > 0 ? '#166534' : colors.ink + '77' }}>{r.bonuses.toFixed(0)} AED</td>
                  <td className="mono" style={{ padding: '10px 12px', textAlign: 'right', color: r.deductions > 0 ? '#991B1B' : colors.ink + '77' }}>{r.deductions.toFixed(0)} AED</td>
                  <td className="mono" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: colors.accent, fontSize: '14px' }}>{r.net.toFixed(0)} AED</td>
                </tr>
              ))}
              {payrollRows.length > 0 && (
                <tr style={{ background: colors.headerGreen + '15', borderTop: `2px solid ${colors.accent}` }}>
                  <td colSpan="2" style={{ padding: '12px', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.ink }}>TOTAL</td>
                  <td className="mono" style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{payrollTotalSalary.toFixed(0)} AED</td>
                  <td className="mono" style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>{payrollTotalBonuses.toFixed(0)} AED</td>
                  <td className="mono" style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: '#991B1B' }}>{payrollTotalDeductions.toFixed(0)} AED</td>
                  <td className="mono" style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: colors.accent, fontSize: '15px' }}>{payrollTotalNet.toFixed(0)} AED</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Helper note for how to add incentives/deductions */}
        <div style={{ marginTop: '10px', padding: '10px 14px', background: colors.accentLight, borderRadius: '8px', fontSize: '12px', color: colors.ink }}>
          💡 <strong>Adding incentives or deductions?</strong> Go to the <strong>Payroll</strong> tab, pick the employee, then use the <strong>Bonuses</strong> or <strong>Deductions</strong> sub-tab. The totals here will update automatically.
        </div>

        {/* Other Expenses subtotal row */}
        <div style={{ marginTop: '12px', padding: '14px 16px', background: colors.soft, borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.ink }}>
              + Other Expenses <span style={{ fontSize: '11px', color: colors.ink + '77', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>({filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} in {months[filterMonth]})</span>
            </div>
            <div className="mono" style={{ fontWeight: 700, fontSize: '15px', color: colors.rust }}>{monthTotal.toFixed(0)} AED</div>
          </div>
          {filtered.length > 0 && (
            <div style={{ fontSize: '11px', color: colors.ink + '77', paddingLeft: '2px' }}>
              {filtered.slice(0, 5).map((e, i) => (
                <span key={e.id}>{i > 0 && ' · '}<span style={{ fontWeight: 600 }}>{e.category}</span>: {parseFloat(e.amount).toFixed(0)}</span>
              ))}
              {filtered.length > 5 && <span> · +{filtered.length - 5} more</span>}
            </div>
          )}
        </div>

        {/* GRAND TOTAL */}
        <div style={{ marginTop: '12px', padding: '16px 20px', background: colors.headerGreen, color: 'white', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: colors.gold, fontWeight: 700 }}>GRAND TOTAL</div>
            <div style={{ fontSize: '11px', color: 'white', opacity: 0.8, marginTop: '2px' }}>Salaries + Incentives − Deductions + Other Expenses</div>
          </div>
          <div className="display-font mono" style={{ fontSize: '28px', fontWeight: 800, color: 'white' }}>{grandTotal.toFixed(0)} <span style={{ fontSize: '15px' }}>AED</span></div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '14px 18px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: colors.ink + 'AA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filter:</span>
        <select className="select" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} style={{ width: 'auto' }}>
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, idx) => {
            const isActive = filterMonth === idx;
            return (
              <button
                key={m}
                onClick={() => setFilterMonth(idx)}
                style={{
                  padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${isActive ? colors.headerGreen : colors.border}`,
                  background: isActive ? colors.headerGreen : 'white',
                  color: isActive ? 'white' : colors.ink,
                }}
              >{m}</button>
            );
          })}
        </div>
        <select className="select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ width: 'auto' }}>
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard icon={<Wallet size={18} />} label="Expenses" value={`${monthTotal.toFixed(0)} AED`} color={colors.rust} colors={colors} />
        <StatCard icon={<DollarSign size={18} />} label="Revenue" value={`${periodRevenue.toFixed(0)} AED`} color={colors.accent} colors={colors} />
        <StatCard icon={<TrendingUp size={18} />} label={profit >= 0 ? 'Profit' : 'Loss'} value={`${profit.toFixed(0)} AED`} color={profit >= 0 ? colors.accent : colors.rust} colors={colors} />
        <StatCard icon={<FileText size={18} />} label="Entries" value={filtered.length} color={colors.ink} colors={colors} />
      </div>

      {/* Breakdown by category */}
      {categoryList.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, padding: '20px', marginBottom: '20px' }}>
          <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>By Category · {months[filterMonth]} {filterYear}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {categoryList.map(([cat, amt]) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '180px' }}>{cat}</span>
                <div style={{ flex: 1, background: colors.soft, height: '20px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(amt / monthTotal) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${colors.rust}, ${colors.gold})` }}></div>
                </div>
                <span className="mono" style={{ minWidth: '90px', textAlign: 'right', fontWeight: 700, color: colors.rust }}>{amt.toFixed(0)} AED</span>
                <span style={{ minWidth: '50px', textAlign: 'right', fontSize: '12px', color: colors.ink + '99' }}>{((amt / monthTotal) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses table */}
      <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: colors.ink + '99' }}>
            <Wallet size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <h3 style={{ margin: '0 0 8px' }}>No expenses for {months[filterMonth]} {filterYear}</h3>
            <p style={{ fontSize: '13px', margin: '0 0 16px' }}>Click "New Expense" to add your first one.</p>
            <button className="btn btn-primary" onClick={startNew}><Plus size={14} /> Add Expense</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: colors.soft }}>
                  <Th>Date</Th><Th>Category</Th><Th>Description</Th><Th>Vendor</Th>
                  <Th>Payment</Th><Th style={{ textAlign: 'right' }}>Amount (AED)</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                    <Td className="mono" style={{ fontSize: '12px' }}>{new Date(e.date).toLocaleDateString('en-GB')}</Td>
                    <Td><span className="badge" style={{ background: colors.cellMaterials, color: colors.accent }}>{e.category}</span></Td>
                    <Td>{e.description || <span style={{ color: colors.ink + '66' }}>—</span>}</Td>
                    <Td>{e.vendor || <span style={{ color: colors.ink + '66' }}>—</span>}</Td>
                    <Td><span className="badge" style={{ background: colors.soft }}>{e.paymentMethod}</span></Td>
                    <Td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: colors.rust }}>{parseFloat(e.amount || 0).toFixed(2)}</Td>
                    <Td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-sm" onClick={() => startEdit(e)} style={{ padding: '4px 8px' }}><Edit2 size={12} /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(e.id)} style={{ padding: '4px 8px' }}><Trash2 size={12} /></button>
                      </div>
                    </Td>
                  </tr>
                ))}
                <tr style={{ background: colors.soft, fontWeight: 700 }}>
                  <Td colSpan="5" style={{ textAlign: 'right' }}>TOTAL</Td>
                  <Td className="mono" style={{ textAlign: 'right', color: colors.rust, fontSize: '15px' }}>{monthTotal.toFixed(2)}</Td>
                  <Td></Td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="display-font" style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>{expenses.find(e => e.id === editing.id) ? 'Edit Expense' : 'New Expense'}</h3>
              <button className="btn btn-sm" onClick={() => setEditing(null)} style={{ padding: '6px' }}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="Date *">
                  <input className="input" type="date" value={editing.date} onChange={e => setEditing({ ...editing, date: e.target.value })} />
                </Field>
                <Field label="Amount (AED) *">
                  <input className="input" type="number" step="0.01" value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value })} placeholder="0.00" />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="Category *">
                  <select className="select" value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Payment Method *">
                  <select className="select" value={editing.paymentMethod} onChange={e => setEditing({ ...editing, paymentMethod: e.target.value })}>
                    {EXPENSE_PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Description">
                <input className="input" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} placeholder="What was this expense for?" />
              </Field>
              <Field label="Vendor / Paid To">
                <input className="input" value={editing.vendor} onChange={e => setEditing({ ...editing, vendor: e.target.value })} placeholder="Company / person name" />
              </Field>
              <Field label="Receipt / Reference No.">
                <input className="input" value={editing.receipt} onChange={e => setEditing({ ...editing, receipt: e.target.value })} placeholder="Optional reference number" />
              </Field>
              <Field label="Notes">
                <textarea className="input" rows="2" value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} style={{ resize: 'vertical' }} />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}><Save size={14} /> Save Expense</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CloudSyncBadge({ status, lastSync, colors }) {
  const config = {
    connecting: { icon: <RefreshCw size={12} className="spin" />, label: 'Connecting...', bg: '#FEF3C7', color: '#D97706', border: '#F59E0B' },
    synced: { icon: <Cloud size={12} />, label: 'Synced', bg: '#D1FAE5', color: '#0F4C3A', border: '#10B981' },
    syncing: { icon: <RefreshCw size={12} className="spin" />, label: 'Syncing...', bg: '#DBEAFE', color: '#1D4ED8', border: '#3B82F6' },
    offline: { icon: <CloudOff size={12} />, label: 'Offline', bg: '#FEE2E2', color: '#B8472A', border: '#EF4444' }
  };
  const c = config[status] || config.connecting;
  const tooltip = lastSync ? `Last synced: ${lastSync.toLocaleTimeString()}` : 'Cloud sync status';

  return (
    <div title={tooltip} style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '5px 10px', borderRadius: '6px',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'
    }}>
      <style>{`.spin { animation: spin 1.2s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {c.icon} {c.label}
    </div>
  );
}

function ExportRangeModal({ onExport, onClose, colors, allBookings, expenses }) {
  // Calculate sensible defaults: earliest date and today
  const allDates = [...allBookings.map(b => b.date), ...expenses.map(e => e.date)].filter(Boolean).sort();
  const earliestDate = allDates[0] || new Date().toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const [rangeStart, setRangeStart] = React.useState('');
  const [rangeEnd, setRangeEnd] = React.useState('');
  const [preset, setPreset] = React.useState('all');

  const applyPreset = (p) => {
    setPreset(p);
    const now = new Date();
    if (p === 'all') {
      setRangeStart(''); setRangeEnd('');
    } else if (p === 'today') {
      setRangeStart(today); setRangeEnd(today);
    } else if (p === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      setRangeStart(start.toISOString().split('T')[0]); setRangeEnd(today);
    } else if (p === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setRangeStart(start.toISOString().split('T')[0]); setRangeEnd(today);
    } else if (p === 'lastMonth') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setRangeStart(start.toISOString().split('T')[0]); setRangeEnd(end.toISOString().split('T')[0]);
    } else if (p === 'thisYear') {
      const start = new Date(now.getFullYear(), 0, 1);
      setRangeStart(start.toISOString().split('T')[0]); setRangeEnd(today);
    } else if (p === 'custom') {
      // Just leave whatever the user has
    }
  };

  const presets = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Last 7 Days' },
    { id: 'thisMonth', label: 'This Month' },
    { id: 'lastMonth', label: 'Last Month' },
    { id: 'thisYear', label: 'This Year' },
    { id: 'custom', label: 'Custom Range' }
  ];

  // Count what would be in the export
  const inRange = (dateStr) => {
    if (!rangeStart && !rangeEnd) return true;
    if (rangeStart && dateStr < rangeStart) return false;
    if (rangeEnd && dateStr > rangeEnd) return false;
    return true;
  };
  const bookingCount = allBookings.filter(b => inRange(b.date)).length;
  const expenseCount = expenses.filter(e => inRange(e.date)).length;
  const totalRev = allBookings.filter(b => inRange(b.date)).reduce((s, b) => s + (b.total || 0), 0);
  const totalExp = expenses.filter(e => inRange(e.date)).reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="display-font" style={{ margin: 0, fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={20} color={colors.accent} /> Mega Excel Export
          </h3>
          <button className="btn btn-sm" onClick={onClose} style={{ padding: '6px' }}><X size={14} /></button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: '13px', color: colors.ink + '99' }}>
          Pick a date range to export <strong>everything</strong>: dashboard summary + all bookings, clients, contracts, expenses, earnings, pending payments, cleaner homes — all in one Excel file.
        </p>

        <h4 className="display-font" style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700 }}>Quick presets</h4>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {presets.map(p => (
            <button key={p.id} className={`btn btn-sm ${preset === p.id ? 'btn-primary' : ''}`} onClick={() => applyPreset(p.id)} style={{ fontSize: '12px' }}>
              {p.label}
            </button>
          ))}
        </div>

        <h4 className="display-font" style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700 }}>Custom date range</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <Field label="From">
            <input type="date" className="input" value={rangeStart} onChange={e => { setRangeStart(e.target.value); setPreset('custom'); }} />
          </Field>
          <Field label="To">
            <input type="date" className="input" value={rangeEnd} onChange={e => { setRangeEnd(e.target.value); setPreset('custom'); }} />
          </Field>
        </div>
        <p style={{ fontSize: '11px', color: colors.ink + '99', margin: '0 0 16px' }}>
          Leave both empty for all-time export.
        </p>

        <div style={{ background: colors.accentLight, border: `1.5px solid ${colors.accent}`, padding: '14px 18px', borderRadius: '10px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: colors.ink + 'AA', marginBottom: '4px' }}>Preview</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '13px' }}>
            <div><strong>{bookingCount}</strong> bookings · <span style={{ color: colors.accent, fontWeight: 700 }}>{totalRev.toFixed(0)} AED</span> revenue</div>
            <div><strong>{expenseCount}</strong> expenses · <span style={{ color: colors.rust, fontWeight: 700 }}>{totalExp.toFixed(0)} AED</span> spent</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onExport(rangeStart, rangeEnd)}>
            <Download size={14} /> Generate Excel
          </button>
        </div>
      </div>
    </div>
  );
}

function WhatsAppReminderModal({ client, companyInfo, stats, colors, onClose }) {
  // Calculate tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowFormatted = tomorrow.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const dayName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });

  const companyName = companyInfo?.name || 'AR Cleaning Services';
  const companyPhone = companyInfo?.phone || '';
  const firstName = (client.name || 'there').split(' ')[0];

  const TEMPLATES = [
    {
      id: 'check_in',
      label: '👋 Friendly check-in',
      description: 'Soft offer with available slots — best for lapsed clients',
      message: `Hi ${firstName}! 👋\n\nIt's ${companyName}.\n\nI had a couple of free slots open up for tomorrow (${dayName}) — would you like a freshen-up visit?\n\nIf yes, just reply with a preferred time and I'll add you to the schedule. No pressure if not — just thought of you! ✨\n\n📞 ${companyPhone}`
    },
    {
      id: 'remind_visit',
      label: '📅 Reminder + slot options',
      description: `It's been ${stats.daysSince || 0} days since their last visit`,
      message: `Hi ${firstName}!\n\nHope you're doing well. ${stats.daysSince ? `It's been about ${stats.daysSince} day${stats.daysSince > 1 ? 's' : ''} since your last cleaning` : 'Just checking in'} — would you like to schedule the next visit?\n\nI have these slots tomorrow (${dayName}):\n🕗 8-10 AM\n🕒 2-4 PM\n🕓 4-6 PM\n\nReply with the time that works for you 👍\n\n— ${companyName}\n📞 ${companyPhone}`
    },
    {
      id: 'discount',
      label: '🎁 10% off for tomorrow',
      description: 'Time-bound discount — creates urgency',
      message: `Hi ${firstName}! 🌟\n\nTomorrow's calendar (${dayName}) has some open slots — to keep our team busy, I'm offering *10% off* for any booking made today for tomorrow's service.\n\nWant me to lock in a slot for you? Just reply 'BOOK' 📅\n\n— ${companyName}\n📞 ${companyPhone}`
    },
    {
      id: 'confirm_visit',
      label: '✅ Confirm tomorrow\'s visit',
      description: 'For regular contract clients with a booking tomorrow',
      message: `Good morning, ${firstName}! ☀️\n\nJust a heads-up — your cleaning is confirmed for tomorrow (${tomorrowFormatted}).\n\nIs there anything specific you'd like us to focus on?\n• Deep clean kitchen\n• Wash bed sheets\n• Iron clothes\n• Anything else — just let me know!\n\nSee you tomorrow! ✨\n\n— ${companyName}`
    },
    {
      id: 'lapsed',
      label: '💌 Long-lapsed client',
      description: 'For clients you haven\'t seen in 30+ days',
      message: `Hi ${firstName}!\n\nIt's been a while since we cleaned for you — hope everything's well at home.\n\nIf you'd like to schedule a visit (this week or next), just message me back. As a thank-you for being a previous client, your next booking is *15% off*. 🎁\n\nLooking forward to hearing from you!\n\n— ${companyName}\n📞 ${companyPhone}`
    }
  ];

  const [selectedId, setSelectedId] = React.useState(stats.daysSince > 30 ? 'lapsed' : stats.daysSince > 7 ? 'check_in' : 'remind_visit');
  const selected = TEMPLATES.find(t => t.id === selectedId);
  const [editedMessage, setEditedMessage] = React.useState(selected.message);

  React.useEffect(() => {
    setEditedMessage(selected.message);
  }, [selectedId]);

  const sendMessage = () => {
    const phone = (client.phone || '').replace(/[^0-9]/g, '');
    if (!phone) {
      alert('No phone number for this client. Add a phone number first.');
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(editedMessage)}`;
    window.open(url, '_blank');
  };

  const copyMessage = () => {
    navigator.clipboard.writeText(editedMessage).then(() => {
      alert('✓ Message copied to clipboard');
    }).catch(() => {
      alert('Couldn\'t copy automatically. Please select the text manually.');
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '95vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 className="display-font" style={{ margin: 0, fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageCircle size={20} color="#25D366" /> WhatsApp Reminder
          </h3>
          <button className="btn btn-sm" onClick={onClose} style={{ padding: '6px' }}><X size={14} /></button>
        </div>

        <div style={{ background: colors.soft, padding: '12px 14px', borderRadius: '8px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{client.name}</div>
              {client.phone && <div className="mono" style={{ fontSize: '12px', color: colors.ink + 'AA' }}>{client.phone}</div>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: colors.ink + '99' }}>Last visit</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: stats.daysSince > 30 ? colors.rust : stats.daysSince > 14 ? '#D97706' : colors.accent }}>
                {stats.lastVisitDate ? `${stats.daysSince === 0 ? 'Today' : stats.daysSince === 1 ? 'Yesterday' : `${stats.daysSince} days ago`}` : 'No previous visits'}
              </div>
            </div>
          </div>
        </div>

        <h4 className="display-font" style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700 }}>1. Pick a template</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          {TEMPLATES.map(t => (
            <label key={t.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '10px 12px', borderRadius: '6px',
              background: selectedId === t.id ? colors.accentLight : 'white',
              border: `1px solid ${selectedId === t.id ? colors.accent : colors.border}`,
              cursor: 'pointer'
            }}>
              <input type="radio" name="template" checked={selectedId === t.id} onChange={() => setSelectedId(t.id)} style={{ marginTop: '3px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{t.label}</div>
                <div style={{ fontSize: '11px', color: colors.ink + '99' }}>{t.description}</div>
              </div>
            </label>
          ))}
        </div>

        <h4 className="display-font" style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700 }}>2. Edit message (optional)</h4>
        <textarea
          className="input"
          value={editedMessage}
          onChange={e => setEditedMessage(e.target.value)}
          rows="10"
          style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '13px', marginBottom: '14px', whiteSpace: 'pre-wrap' }}
        />

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn" onClick={copyMessage}>
            <FileText size={14} /> Copy text
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" style={{ background: '#25D366', color: 'white', borderColor: '#25D366' }} onClick={sendMessage}>
            <MessageCircle size={14} /> Open WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PAYROLL VIEW — manage each cleaner's monthly salary, bonuses, deductions,
// attendance and working hours. Data lives in localStorage under sparkle_payroll.
// Structure: payroll[monthKey][cleanerName] = { salary, bonuses[], deductions[],
//   attendance{dateISO: 'present'|'absent'|'half'}, workingHours, notes }
// ============================================================================
function PayrollView({ payroll, savePayroll, CLEANERS, PAYROLL_ROSTER, colors }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  // Use PAYROLL_ROSTER (which includes non-cleaners like Malek) — fallback to CLEANERS list
  const rosterNames = (PAYROLL_ROSTER && PAYROLL_ROSTER.length > 0) ? PAYROLL_ROSTER.map(p => p.name) : (CLEANERS || []);
  const [selectedCleaner, setSelectedCleaner] = useState(rosterNames[0] || '');
  const [tab, setTab] = useState('summary'); // summary | attendance | bonuses | deductions

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const yearOptions = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) yearOptions.push(y);
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthName = `${months[month]} ${year}`;

  // One-click: fill every employee's default salary for the selected month.
  // Preserves existing bonuses and deductions — only overwrites base salary.
  const generateAllSalaries = () => {
    if (!PAYROLL_ROSTER || PAYROLL_ROSTER.length === 0) return;
    const monthData = payroll[monthKey] || {};
    const existingCount = Object.values(monthData).filter(r => (r.salary || 0) > 0).length;
    const msg = existingCount > 0
      ? `This will set default salaries for ${PAYROLL_ROSTER.length} employees for ${monthName}, overwriting existing base salary values (bonuses & deductions kept). Continue?`
      : `Set default salaries for ${PAYROLL_ROSTER.length} employees for ${monthName}?`;
    if (!confirm(msg)) return;
    const nextMonthData = { ...monthData };
    PAYROLL_ROSTER.forEach(person => {
      const existing = nextMonthData[person.name] || { salary: 0, bonuses: [], deductions: [], attendance: {}, workingHours: 0, notes: '' };
      nextMonthData[person.name] = { ...existing, salary: person.defaultSalary };
    });
    savePayroll({ ...payroll, [monthKey]: nextMonthData });
  };

  // Ensure the record exists for this cleaner + month
  const record = payroll[monthKey]?.[selectedCleaner] || {
    salary: 0,
    bonuses: [],
    deductions: [],
    attendance: {},
    workingHours: 0,
    notes: '',
  };

  // Update this cleaner's record for this month
  const updateRecord = (patch) => {
    const next = {
      ...payroll,
      [monthKey]: {
        ...(payroll[monthKey] || {}),
        [selectedCleaner]: { ...record, ...patch },
      },
    };
    savePayroll(next);
  };

  // Totals
  const totalBonuses = record.bonuses.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalDeductions = record.deductions.reduce((s, d) => s + Number(d.amount || 0), 0);
  const netPay = Number(record.salary || 0) + totalBonuses - totalDeductions;

  // Days in the selected month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const attendanceCount = {
    present: Object.values(record.attendance).filter(v => v === 'present').length,
    absent: Object.values(record.attendance).filter(v => v === 'absent').length,
    half: Object.values(record.attendance).filter(v => v === 'half').length,
  };
  const workedDays = attendanceCount.present + attendanceCount.half * 0.5;

  const setAttendance = (day, status) => {
    const dateISO = `${monthKey}-${String(day).padStart(2, '0')}`;
    const nextAttendance = { ...record.attendance };
    if (nextAttendance[dateISO] === status) {
      delete nextAttendance[dateISO]; // toggle off
    } else {
      nextAttendance[dateISO] = status;
    }
    updateRecord({ attendance: nextAttendance });
  };

  const addBonus = () => {
    updateRecord({
      bonuses: [
        ...record.bonuses,
        { id: Date.now(), amount: 0, reason: '', date: new Date().toISOString().slice(0, 10) },
      ],
    });
  };
  const updateBonus = (id, field, value) => {
    updateRecord({
      bonuses: record.bonuses.map(b => b.id === id ? { ...b, [field]: value } : b),
    });
  };
  const removeBonus = (id) => {
    updateRecord({ bonuses: record.bonuses.filter(b => b.id !== id) });
  };

  const addDeduction = () => {
    updateRecord({
      deductions: [
        ...record.deductions,
        { id: Date.now(), amount: 0, reason: '', date: new Date().toISOString().slice(0, 10) },
      ],
    });
  };
  const updateDeduction = (id, field, value) => {
    updateRecord({
      deductions: record.deductions.map(d => d.id === id ? { ...d, [field]: value } : d),
    });
  };
  const removeDeduction = (id) => {
    updateRecord({ deductions: record.deductions.filter(d => d.id !== id) });
  };

  const attColor = {
    present: { bg: '#DCFCE7', border: '#22C55E', text: '#166534' },
    absent: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' },
    half: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Payroll</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>Monthly salary, bonuses, deductions and attendance for each employee</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {PAYROLL_ROSTER && PAYROLL_ROSTER.length > 0 && (
            <button
              onClick={generateAllSalaries}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '13px' }}
              title="One click fills every employee's default salary for this month"
            >
              <RefreshCw size={13} /> Generate All Salaries
            </button>
          )}
          <select className="select" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: 'auto' }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Month quick-jump bar */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', background: 'white', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${colors.border}` }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: colors.ink + '99', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>⚡ Jump to:</span>
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, idx) => {
            const isActive = month === idx;
            return (
              <button
                key={m}
                onClick={() => setMonth(idx)}
                style={{
                  padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${isActive ? colors.headerGreen : colors.border}`,
                  background: isActive ? colors.headerGreen : 'white',
                  color: isActive ? 'white' : colors.ink,
                }}
              >{m}</button>
            );
          })}
        </div>
      </div>

      {/* Employee picker (uses payroll roster: includes non-cleaners like supervisors/drivers) */}
      <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.ink + '99', fontWeight: 600, marginBottom: '8px' }}>Select employee</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {rosterNames.map(c => {
            const person = PAYROLL_ROSTER && PAYROLL_ROSTER.find(p => p.name === c);
            const isNonCleaner = person && person.role && person.role !== 'Cleaner';
            return (
              <button
                key={c}
                onClick={() => setSelectedCleaner(c)}
                style={{
                  padding: '8px 14px', borderRadius: '99px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  background: selectedCleaner === c ? colors.headerGreen : colors.soft,
                  color: selectedCleaner === c ? 'white' : colors.ink,
                  border: `1px solid ${selectedCleaner === c ? colors.headerGreen : colors.border}`,
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                }}
                title={isNonCleaner ? `${person.role}` : ''}
              >
                {c}
                {isNonCleaner && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: selectedCleaner === c ? colors.gold : colors.accent, color: selectedCleaner === c ? colors.ink : 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{person.role}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.ink + '99', fontWeight: 600 }}>Base Salary</div>
          <div className="display-font mono" style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>{Number(record.salary || 0).toFixed(0)} <span style={{ fontSize: '13px', color: colors.ink + '99' }}>AED</span></div>
        </div>
        <div style={{ background: '#DCFCE7', border: `1px solid #22C55E`, borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#166534', fontWeight: 600 }}>+ Bonuses</div>
          <div className="display-font mono" style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', color: '#166534' }}>+{totalBonuses.toFixed(0)} <span style={{ fontSize: '13px' }}>AED</span></div>
        </div>
        <div style={{ background: '#FEE2E2', border: `1px solid #EF4444`, borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#991B1B', fontWeight: 600 }}>− Deductions</div>
          <div className="display-font mono" style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', color: '#991B1B' }}>−{totalDeductions.toFixed(0)} <span style={{ fontSize: '13px' }}>AED</span></div>
        </div>
        <div style={{ background: colors.accentLight, border: `2px solid ${colors.accent}`, borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.accent, fontWeight: 700 }}>Net Pay</div>
          <div className="display-font mono" style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px', color: colors.accent }}>{netPay.toFixed(0)} <span style={{ fontSize: '13px' }}>AED</span></div>
        </div>
        <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.ink + '99', fontWeight: 600 }}>Days Worked</div>
          <div className="display-font" style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>{workedDays} <span style={{ fontSize: '13px', color: colors.ink + '99' }}>/ {daysInMonth}</span></div>
          <div style={{ fontSize: '10px', color: colors.ink + '77', marginTop: '2px' }}>{attendanceCount.present} present · {attendanceCount.half} half · {attendanceCount.absent} absent</div>
        </div>
        <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '14px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.ink + '99', fontWeight: 600 }}>Working Hours</div>
          <div className="display-font mono" style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>{Number(record.workingHours || 0).toFixed(0)}h</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${colors.border}`, marginBottom: '16px' }}>
        {[
          { id: 'summary', label: 'Salary & Hours', icon: <DollarSign size={14} /> },
          { id: 'attendance', label: 'Attendance', icon: <CalendarDays size={14} /> },
          { id: 'bonuses', label: `Bonuses (${record.bonuses.length})`, icon: <TrendingUp size={14} /> },
          { id: 'deductions', label: `Deductions (${record.deductions.length})`, icon: <AlertCircle size={14} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
              color: tab === t.id ? colors.accent : colors.ink + '99',
              borderBottom: tab === t.id ? `2px solid ${colors.accent}` : '2px solid transparent',
              marginBottom: '-1px', display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >{t.icon} {t.label}</button>
        ))}
      </div>

      {/* Salary + hours tab */}
      {tab === 'summary' && (
        <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '20px' }}>
          <h3 className="display-font" style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700 }}>Salary & Working Hours for {selectedCleaner} · {monthName}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <Field label="Base salary (AED)">
              <input
                type="number"
                className="select"
                value={record.salary || ''}
                onChange={e => updateRecord({ salary: Number(e.target.value) || 0 })}
                placeholder="e.g. 1500"
              />
            </Field>
            <Field label="Total working hours">
              <input
                type="number"
                step="0.5"
                className="select"
                value={record.workingHours || ''}
                onChange={e => updateRecord({ workingHours: Number(e.target.value) || 0 })}
                placeholder="e.g. 180"
              />
            </Field>
          </div>
          <div style={{ marginTop: '16px' }}>
            <Field label="Notes (optional)">
              <textarea
                className="select"
                value={record.notes || ''}
                onChange={e => updateRecord({ notes: e.target.value })}
                placeholder="e.g. joined mid-month, awaiting Emirates ID, etc."
                rows={3}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
              />
            </Field>
          </div>
        </div>
      )}

      {/* Attendance tab — manual calendar-style grid */}
      {tab === 'attendance' && (
        <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 className="display-font" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Attendance for {selectedCleaner} · {monthName}</h3>
            <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: colors.ink + '99' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: attColor.present.border }} /> Present</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: attColor.half.border }} /> Half</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: attColor.absent.border }} /> Absent</span>
            </div>
          </div>
          <p style={{ fontSize: '12px', color: colors.ink + '77', margin: '0 0 14px' }}>Click a day to cycle through: <strong>Present → Half → Absent → (blank)</strong>. Or use the three buttons below each date.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '6px' }}>
            {daysArray.map(d => {
              const dateISO = `${monthKey}-${String(d).padStart(2, '0')}`;
              const status = record.attendance[dateISO];
              const c = status ? attColor[status] : { bg: 'white', border: colors.border, text: colors.ink };
              const dayName = new Date(year, month, d).toLocaleDateString('en-US', { weekday: 'short' });
              return (
                <div key={d} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: '8px', padding: '6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: c.text, fontWeight: 600, textTransform: 'uppercase' }}>{dayName}</div>
                  <div className="display-font" style={{ fontSize: '18px', fontWeight: 700, color: c.text, lineHeight: 1 }}>{d}</div>
                  <div style={{ display: 'flex', gap: '2px', marginTop: '4px', justifyContent: 'center' }}>
                    <button onClick={() => setAttendance(d, 'present')} title="Present" style={{ width: '18px', height: '18px', borderRadius: '4px', border: 'none', background: status === 'present' ? attColor.present.border : attColor.present.bg, cursor: 'pointer', color: status === 'present' ? 'white' : attColor.present.text, fontSize: '10px', fontWeight: 700 }}>P</button>
                    <button onClick={() => setAttendance(d, 'half')} title="Half day" style={{ width: '18px', height: '18px', borderRadius: '4px', border: 'none', background: status === 'half' ? attColor.half.border : attColor.half.bg, cursor: 'pointer', color: status === 'half' ? 'white' : attColor.half.text, fontSize: '10px', fontWeight: 700 }}>H</button>
                    <button onClick={() => setAttendance(d, 'absent')} title="Absent" style={{ width: '18px', height: '18px', borderRadius: '4px', border: 'none', background: status === 'absent' ? attColor.absent.border : attColor.absent.bg, cursor: 'pointer', color: status === 'absent' ? 'white' : attColor.absent.text, fontSize: '10px', fontWeight: 700 }}>A</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bonuses tab */}
      {tab === 'bonuses' && (
        <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 className="display-font" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Bonuses for {selectedCleaner} · {monthName}</h3>
            <button className="btn btn-primary btn-sm" onClick={addBonus}><Plus size={12} /> Add bonus</button>
          </div>
          {record.bonuses.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: colors.ink + '66', fontSize: '13px' }}>
              No bonuses yet this month. Click “Add bonus” to record one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {record.bonuses.map(b => (
                <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '120px 130px 1fr auto', gap: '8px', alignItems: 'center', padding: '10px', background: '#DCFCE7', border: '1px solid #22C55E', borderRadius: '8px' }}>
                  <input type="date" className="select" value={b.date || ''} onChange={e => updateBonus(b.id, 'date', e.target.value)} />
                  <input type="number" className="select" value={b.amount || ''} placeholder="Amount" onChange={e => updateBonus(b.id, 'amount', Number(e.target.value) || 0)} style={{ fontFamily: 'monospace', fontWeight: 700 }} />
                  <input type="text" className="select" value={b.reason || ''} placeholder="Reason (e.g. good performance, extra job)" onChange={e => updateBonus(b.id, 'reason', e.target.value)} />
                  <button onClick={() => removeBonus(b.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#991B1B', padding: '6px' }} title="Remove"><Trash2 size={14} /></button>
                </div>
              ))}
              <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'flex-end', fontSize: '14px', fontWeight: 700 }}>
                Total bonuses: <span className="mono" style={{ color: '#166534', marginLeft: '10px' }}>+{totalBonuses.toFixed(2)} AED</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deductions tab */}
      {tab === 'deductions' && (
        <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 className="display-font" style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Deductions for {selectedCleaner} · {monthName}</h3>
            <button className="btn btn-primary btn-sm" onClick={addDeduction}><Plus size={12} /> Add deduction</button>
          </div>
          {record.deductions.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: colors.ink + '66', fontSize: '13px' }}>
              No deductions yet this month. Click “Add deduction” to record one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {record.deductions.map(d => (
                <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '120px 130px 1fr auto', gap: '8px', alignItems: 'center', padding: '10px', background: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '8px' }}>
                  <input type="date" className="select" value={d.date || ''} onChange={e => updateDeduction(d.id, 'date', e.target.value)} />
                  <input type="number" className="select" value={d.amount || ''} placeholder="Amount" onChange={e => updateDeduction(d.id, 'amount', Number(e.target.value) || 0)} style={{ fontFamily: 'monospace', fontWeight: 700 }} />
                  <input type="text" className="select" value={d.reason || ''} placeholder="Reason (e.g. absence, uniform, advance repayment)" onChange={e => updateDeduction(d.id, 'reason', e.target.value)} />
                  <button onClick={() => removeDeduction(d.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#991B1B', padding: '6px' }} title="Remove"><Trash2 size={14} /></button>
                </div>
              ))}
              <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'flex-end', fontSize: '14px', fontWeight: 700 }}>
                Total deductions: <span className="mono" style={{ color: '#991B1B', marginLeft: '10px' }}>−{totalDeductions.toFixed(2)} AED</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, colors }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: color, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{icon} {label}</div>
      <div className="display-font" style={{ fontSize: '22px', fontWeight: 700, color: colors.ink, marginTop: '4px' }}>{value}</div>
    </div>
  );
}
function Th({ children }) { return <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1A1A1A99' }}>{children}</th>; }
function Td({ children, style = {}, ...rest }) { return <td style={{ padding: '8px 10px', verticalAlign: 'middle', ...style }} {...rest}>{children}</td>; }
function ReportTh({ children }) { return <th style={{ padding: '8px 10px', border: '1px solid #1A1A1A', textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{children}</th>; }
function ReportTd({ children, style = {}, ...rest }) { return <td style={{ padding: '6px 10px', border: '1px solid #1A1A1A', ...style }} {...rest}>{children}</td>; }
function Field({ label, children }) { return <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><span style={{ fontSize: '12px', fontWeight: 600, color: '#1A1A1AAA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>{children}</label>; }
function SummaryBox({ label, value, colors, highlight, warning }) {
  const border = highlight ? colors.accent : warning ? colors.warning : colors.border;
  const bg = highlight ? colors.accentLight : warning ? '#FEF3C7' : 'transparent';
  const valueColor = highlight ? colors.accent : warning ? colors.warning : colors.ink;
  return (
    <div style={{ border: `1.5px solid ${border}`, borderRadius: '8px', padding: '14px', background: bg }}>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.ink + '99', fontWeight: 600 }}>{label}</div>
      <div className="display-font" style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', color: valueColor }}>{value}</div>
    </div>
  );
}
