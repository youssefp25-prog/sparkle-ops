import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Trash2, FileText, Grid3x3, Download, Printer, Save, RotateCcw, Users, DollarSign, Clock, BookUser, TrendingUp, AlertCircle, Repeat, Search, X, Check, Phone, MapPin, Edit2, ChevronRight, FileSpreadsheet } from 'lucide-react';

const CLEANERS = ['Leah', 'Eva', 'Zainab', 'Roselyn', 'Coline', 'Angel', 'Razelle'];
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
  withMaterials: false, pricePerHour: 25, paymentType: 'ONLINE', paymentStatus: 'PENDING', notes: ''
});

const emptyClient = () => ({
  id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
  name: '', phone: '', address: '', defaultRate: 25, defaultMaterials: false, notes: ''
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

  useEffect(() => {
    try {
      const daysRaw = localStorage.getItem('sparkle_all_days');
      if (daysRaw) {
        const d = JSON.parse(daysRaw);
        setSavedDays(d);
        const today = new Date().toISOString().split('T')[0];
        if (d[today]) setBookings(d[today].bookings);
      }
    } catch (e) {}
    try {
      const clientsRaw = localStorage.getItem('sparkle_clients');
      if (clientsRaw) setClients(JSON.parse(clientsRaw));
    } catch (e) {}
    try {
      const contractsRaw = localStorage.getItem('sparkle_contracts');
      if (contractsRaw) setContracts(JSON.parse(contractsRaw));
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (savedDays[date]) setBookings(savedDays[date].bookings);
  }, [date]);

  const showStatus = (m) => { setStatusMsg(m); setTimeout(() => setStatusMsg(''), 2500); };
  const updateBooking = (id, field, value) => setBookings(bookings.map(b => b.id === id ? { ...b, [field]: value } : b));
  const addBooking = () => setBookings([...bookings, emptyBooking()]);
  const removeBooking = (id) => setBookings(bookings.filter(b => b.id !== id));

  const applyClientToBooking = (bookingId, client) => {
    setBookings(bookings.map(b => b.id === bookingId ? {
      ...b, clientId: client.id, clientName: client.name, location: client.address,
      phone: client.phone, pricePerHour: client.defaultRate, withMaterials: client.defaultMaterials,
    } : b));
    setClientPickerFor(null);
  };

  const saveDay = () => {
    const newSaved = { ...savedDays, [date]: { bookings, savedAt: new Date().toISOString() } };
    setSavedDays(newSaved);
    try {
      localStorage.setItem('sparkle_all_days', JSON.stringify(newSaved));
      showStatus('✓ Day saved');
    } catch (e) { showStatus('⚠ Save failed'); }
  };

  const clearDay = () => { if (confirm('Clear bookings for this day?')) setBookings([emptyBooking()]); };
  const loadDate = (d) => { setDate(d); if (savedDays[d]) setBookings(savedDays[d].bookings); else setBookings([emptyBooking()]); };

  const saveClients = (next) => {
    setClients(next);
    try { localStorage.setItem('sparkle_clients', JSON.stringify(next)); } catch (e) {}
  };
  const saveContracts = (next) => {
    setContracts(next);
    try { localStorage.setItem('sparkle_contracts', JSON.stringify(next)); } catch (e) {}
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

  // ===== EXCEL EXPORT FUNCTIONS =====
  const exportDailyReportExcel = () => {
    const dayNum = new Date(date).getDate();
    const data = bookingsWithCalc.map(b => ({
      'DATE': dayNum,
      'CLEANER': b.cleaner,
      'TIMINGS': b.timing,
      'CLIENT': b.clientName,
      'LOCATION': b.location,
      'PHONE': b.phone || '',
      'MATERIALS': b.withMaterials ? 'Yes' : 'No',
      'HOURS': b.hours,
      'RATE': b.pricePerHour,
      'TOTAL': b.total.toFixed(2),
      'PAY TYPE': b.paymentType,
      'STATUS': b.paymentStatus || 'PENDING'
    }));
    // Add totals row
    data.push({
      'DATE': '', 'CLEANER': '', 'TIMINGS': '', 'CLIENT': '', 'LOCATION': '',
      'PHONE': '', 'MATERIALS': 'TOTAL', 'HOURS': totalHours.toFixed(1), 'RATE': '',
      'TOTAL': totalRevenue.toFixed(2), 'PAY TYPE': '', 'STATUS': ''
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:6},{wch:10},{wch:10},{wch:20},{wch:30},{wch:15},{wch:10},{wch:6},{wch:6},{wch:8},{wch:10},{wch:10}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Report');
    XLSX.writeFile(wb, `daily_report_${date}.xlsx`);
    showStatus('✓ Excel downloaded');
  };

  const exportClientsExcel = () => {
    const data = clients.map(c => {
      const visits = allBookingsWithDate.filter(b => b.clientId === c.id);
      const revenue = visits.reduce((s, b) => s + (b.total || 0), 0);
      return {
        'NAME': c.name,
        'PHONE': c.phone || '',
        'ADDRESS': c.address || '',
        'DEFAULT RATE/HR': c.defaultRate,
        'WITH MATERIALS': c.defaultMaterials ? 'Yes' : 'No',
        'TOTAL VISITS': visits.length,
        'TOTAL REVENUE': revenue.toFixed(2),
        'NOTES': c.notes || ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:20},{wch:18},{wch:35},{wch:14},{wch:14},{wch:12},{wch:14},{wch:25}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, `clients_${new Date().toISOString().split('T')[0]}.xlsx`);
    showStatus('✓ Excel downloaded');
  };

  const exportContractsExcel = () => {
    const data = contracts.map(c => ({
      'CLIENT': c.clientName,
      'CLEANER': c.cleaner,
      'DAYS': c.daysOfWeek.map(d => DAYS[d]).join(', '),
      'TIMING': c.timing,
      'RATE/HR': c.pricePerHour,
      'MATERIALS': c.withMaterials ? 'Yes' : 'No',
      'PAYMENT': c.paymentType,
      'STATUS': c.active ? 'Active' : 'Paused',
      'START DATE': c.startDate || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:20},{wch:12},{wch:25},{wch:12},{wch:10},{wch:10},{wch:10},{wch:10},{wch:12}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contracts');
    XLSX.writeFile(wb, `contracts_${new Date().toISOString().split('T')[0]}.xlsx`);
    showStatus('✓ Excel downloaded');
  };

  const exportEarningsExcel = (period, filtered) => {
    const stats = CLEANERS.map(name => {
      const jobs = filtered.filter(b => b.cleaner === name);
      return {
        'CLEANER': name,
        'JOBS': jobs.length,
        'HOURS': jobs.reduce((s, b) => s + (b.hours || 0), 0).toFixed(1),
        'UNIQUE CLIENTS': new Set(jobs.map(b => b.clientName)).size,
        'CASH': jobs.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + (b.total || 0), 0).toFixed(2),
        'ONLINE': jobs.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + (b.total || 0), 0).toFixed(2),
        'TOTAL REVENUE': jobs.reduce((s, b) => s + (b.total || 0), 0).toFixed(2)
      };
    });
    // Add grand total
    stats.push({
      'CLEANER': 'GRAND TOTAL',
      'JOBS': filtered.length,
      'HOURS': filtered.reduce((s, b) => s + (b.hours || 0), 0).toFixed(1),
      'UNIQUE CLIENTS': new Set(filtered.map(b => b.clientName)).size,
      'CASH': filtered.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + (b.total || 0), 0).toFixed(2),
      'ONLINE': filtered.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + (b.total || 0), 0).toFixed(2),
      'TOTAL REVENUE': filtered.reduce((s, b) => s + (b.total || 0), 0).toFixed(2)
    });
    const ws = XLSX.utils.json_to_sheet(stats);
    ws['!cols'] = [{wch:14},{wch:8},{wch:8},{wch:14},{wch:10},{wch:10},{wch:14}];

    // Detail sheet with all jobs
    const detailData = filtered.map(b => ({
      'DATE': b.date,
      'CLEANER': b.cleaner,
      'CLIENT': b.clientName,
      'LOCATION': b.location,
      'TIMING': b.timing,
      'HOURS': b.hours,
      'RATE': b.pricePerHour,
      'TOTAL': (b.total || 0).toFixed(2),
      'PAY TYPE': b.paymentType,
      'STATUS': b.paymentStatus || 'PENDING'
    }));
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    wsDetail['!cols'] = [{wch:12},{wch:12},{wch:20},{wch:30},{wch:12},{wch:8},{wch:8},{wch:10},{wch:10},{wch:10}];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail');
    XLSX.writeFile(wb, `earnings_${period}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showStatus('✓ Excel downloaded');
  };

  const exportPendingExcel = () => {
    const pending = allBookingsWithDate.filter(b => b.paymentStatus !== 'PAID' && b.total > 0);
    const today = new Date().setHours(0, 0, 0, 0);
    const data = pending.map(b => {
      const overdue = Math.floor((today - new Date(b.date).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
      return {
        'DATE': b.date,
        'CLIENT': b.clientName,
        'PHONE': b.phone || '',
        'LOCATION': b.location,
        'CLEANER': b.cleaner,
        'TIMING': b.timing,
        'HOURS': b.hours,
        'AMOUNT (AED)': b.total.toFixed(2),
        'PAY TYPE': b.paymentType,
        'DAYS OVERDUE': overdue > 0 ? overdue : 0
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch:12},{wch:20},{wch:18},{wch:30},{wch:12},{wch:12},{wch:8},{wch:14},{wch:10},{wch:14}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pending Payments');
    XLSX.writeFile(wb, `pending_payments_${new Date().toISOString().split('T')[0]}.xlsx`);
    showStatus('✓ Excel downloaded');
  };

  // MASTER EXPORT - all data in one workbook
  const exportEverythingExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Today's bookings
    if (bookingsWithCalc.length > 0) {
      const dayNum = new Date(date).getDate();
      const todayData = bookingsWithCalc.map(b => ({
        'DATE': dayNum, 'CLEANER': b.cleaner, 'TIMINGS': b.timing, 'CLIENT': b.clientName,
        'LOCATION': b.location, 'PHONE': b.phone || '', 'MATERIALS': b.withMaterials ? 'Yes' : 'No',
        'HOURS': b.hours, 'RATE': b.pricePerHour, 'TOTAL': b.total.toFixed(2),
        'PAY TYPE': b.paymentType, 'STATUS': b.paymentStatus || 'PENDING'
      }));
      const ws1 = XLSX.utils.json_to_sheet(todayData);
      ws1['!cols'] = [{wch:6},{wch:10},{wch:10},{wch:20},{wch:30},{wch:15},{wch:10},{wch:6},{wch:6},{wch:8},{wch:10},{wch:10}];
      XLSX.utils.book_append_sheet(wb, ws1, 'Today\'s Report');
    }

    // Sheet 2: All bookings history
    if (allBookingsWithDate.length > 0) {
      const allData = allBookingsWithDate.map(b => ({
        'DATE': b.date, 'CLEANER': b.cleaner, 'TIMINGS': b.timing, 'CLIENT': b.clientName,
        'LOCATION': b.location, 'PHONE': b.phone || '', 'MATERIALS': b.withMaterials ? 'Yes' : 'No',
        'HOURS': b.hours, 'RATE': b.pricePerHour, 'TOTAL': (b.total || 0).toFixed(2),
        'PAY TYPE': b.paymentType, 'STATUS': b.paymentStatus || 'PENDING'
      }));
      const ws2 = XLSX.utils.json_to_sheet(allData);
      ws2['!cols'] = [{wch:12},{wch:10},{wch:10},{wch:20},{wch:30},{wch:15},{wch:10},{wch:6},{wch:6},{wch:8},{wch:10},{wch:10}];
      XLSX.utils.book_append_sheet(wb, ws2, 'All History');
    }

    // Sheet 3: Clients
    if (clients.length > 0) {
      const clientData = clients.map(c => {
        const visits = allBookingsWithDate.filter(b => b.clientId === c.id);
        return {
          'NAME': c.name, 'PHONE': c.phone || '', 'ADDRESS': c.address || '',
          'DEFAULT RATE/HR': c.defaultRate, 'MATERIALS': c.defaultMaterials ? 'Yes' : 'No',
          'TOTAL VISITS': visits.length,
          'TOTAL REVENUE': visits.reduce((s, b) => s + (b.total || 0), 0).toFixed(2),
          'NOTES': c.notes || ''
        };
      });
      const ws3 = XLSX.utils.json_to_sheet(clientData);
      ws3['!cols'] = [{wch:20},{wch:18},{wch:35},{wch:14},{wch:12},{wch:12},{wch:14},{wch:25}];
      XLSX.utils.book_append_sheet(wb, ws3, 'Clients');
    }

    // Sheet 4: Contracts
    if (contracts.length > 0) {
      const contractData = contracts.map(c => ({
        'CLIENT': c.clientName, 'CLEANER': c.cleaner,
        'DAYS': c.daysOfWeek.map(d => DAYS[d]).join(', '),
        'TIMING': c.timing, 'RATE/HR': c.pricePerHour,
        'MATERIALS': c.withMaterials ? 'Yes' : 'No', 'PAYMENT': c.paymentType,
        'STATUS': c.active ? 'Active' : 'Paused'
      }));
      const ws4 = XLSX.utils.json_to_sheet(contractData);
      ws4['!cols'] = [{wch:20},{wch:12},{wch:25},{wch:12},{wch:10},{wch:10},{wch:10},{wch:10}];
      XLSX.utils.book_append_sheet(wb, ws4, 'Contracts');
    }

    // Sheet 5: Earnings by cleaner (all-time)
    const earnings = CLEANERS.map(name => {
      const jobs = allBookingsWithDate.filter(b => b.cleaner === name);
      return {
        'CLEANER': name, 'JOBS': jobs.length,
        'HOURS': jobs.reduce((s, b) => s + (b.hours || 0), 0).toFixed(1),
        'UNIQUE CLIENTS': new Set(jobs.map(b => b.clientName)).size,
        'CASH': jobs.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + (b.total || 0), 0).toFixed(2),
        'ONLINE': jobs.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + (b.total || 0), 0).toFixed(2),
        'TOTAL': jobs.reduce((s, b) => s + (b.total || 0), 0).toFixed(2)
      };
    });
    const ws5 = XLSX.utils.json_to_sheet(earnings);
    ws5['!cols'] = [{wch:14},{wch:8},{wch:8},{wch:14},{wch:10},{wch:10},{wch:14}];
    XLSX.utils.book_append_sheet(wb, ws5, 'Earnings');

    // Sheet 6: Pending payments
    const pending = allBookingsWithDate.filter(b => b.paymentStatus !== 'PAID' && b.total > 0);
    if (pending.length > 0) {
      const todaySafe = new Date().setHours(0, 0, 0, 0);
      const pendingData = pending.map(b => {
        const overdue = Math.floor((todaySafe - new Date(b.date).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
        return {
          'DATE': b.date, 'CLIENT': b.clientName, 'PHONE': b.phone || '',
          'LOCATION': b.location, 'CLEANER': b.cleaner, 'TIMING': b.timing,
          'AMOUNT (AED)': b.total.toFixed(2), 'PAY TYPE': b.paymentType,
          'DAYS OVERDUE': overdue > 0 ? overdue : 0
        };
      });
      const ws6 = XLSX.utils.json_to_sheet(pendingData);
      ws6['!cols'] = [{wch:12},{wch:20},{wch:18},{wch:30},{wch:12},{wch:12},{wch:14},{wch:10},{wch:14}];
      XLSX.utils.book_append_sheet(wb, ws6, 'Pending');
    }

    XLSX.writeFile(wb, `sparkle_operations_full_${new Date().toISOString().split('T')[0]}.xlsx`);
    showStatus('✓ Full export downloaded');
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
          <div>
            <h1 className="display-font" style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: colors.accent }}>Sparkle Operations</h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.ink + '99' }}>Daily deployment, reporting, clients & earnings · Abu Dhabi</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {statusMsg && <span style={{ fontSize: '13px', color: colors.accent, fontWeight: 600 }}>{statusMsg}</span>}
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
        </div>
      </div>

      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        {view === 'input' && <InputView bookings={bookings} bookingsWithCalc={bookingsWithCalc} updateBooking={updateBooking} addBooking={addBooking} removeBooking={removeBooking} clearDay={clearDay} date={date} formatDate={formatDate} colors={colors} totalRevenue={totalRevenue} totalHours={totalHours} cashTotal={cashTotal} onlineTotal={onlineTotal} activeCleaners={activeCleaners} clients={clients} setClientPickerFor={setClientPickerFor} contracts={contracts} generateFromContracts={generateFromContracts} exportEverythingExcel={exportEverythingExcel} />}
        {view === 'deployment' && <DeploymentView byCleaner={byCleaner} CLEANERS={CLEANERS} date={date} formatDate={formatDate} colors={colors} printPage={printPage} />}
        {view === 'report' && <ReportView bookingsWithCalc={bookingsWithCalc} date={date} formatDate={formatDate} colors={colors} totalRevenue={totalRevenue} totalHours={totalHours} cashTotal={cashTotal} onlineTotal={onlineTotal} printPage={printPage} exportCSV={exportCSV} exportDailyReportExcel={exportDailyReportExcel} />}
        {view === 'clients' && <ClientsView clients={clients} saveClients={saveClients} colors={colors} allBookings={allBookingsWithDate} exportClientsExcel={exportClientsExcel} />}
        {view === 'contracts' && <ContractsView contracts={contracts} saveContracts={saveContracts} clients={clients} colors={colors} CLEANERS={CLEANERS} exportContractsExcel={exportContractsExcel} />}
        {view === 'earnings' && <EarningsView allBookings={allBookingsWithDate} CLEANERS={CLEANERS} colors={colors} exportEarningsExcel={exportEarningsExcel} />}
        {view === 'pending' && <PendingView allBookings={allBookingsWithDate} savedDays={savedDays} setSavedDays={setSavedDays} bookings={bookings} setBookings={setBookings} date={date} colors={colors} formatDateShort={formatDateShort} exportPendingExcel={exportPendingExcel} />}
      </div>

      {clientPickerFor && <ClientPickerModal clients={clients} onPick={(c) => applyClientToBooking(clientPickerFor, c)} onClose={() => setClientPickerFor(null)} colors={colors} />}
    </div>
  );
}

function InputView({ bookings, bookingsWithCalc, updateBooking, addBooking, removeBooking, clearDay, date, formatDate, colors, totalRevenue, totalHours, cashTotal, onlineTotal, activeCleaners, clients, setClientPickerFor, contracts, generateFromContracts, exportEverythingExcel }) {
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
                <Th>Mat.</Th><Th>Rate</Th><Th>Hrs</Th><Th>Total</Th><Th>Pay</Th><Th>Status</Th><Th></Th>
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
                      <input className="input" placeholder="Apt 101 Bldg" value={b.location} onChange={e => updateBooking(b.id, 'location', e.target.value)} style={{ marginBottom: '3px', minWidth: '180px' }} />
                      <input className="input" placeholder="Phone" value={b.phone || ''} onChange={e => updateBooking(b.id, 'phone', e.target.value)} style={{ fontSize: '11px', padding: '4px 8px', minWidth: '180px' }} />
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

function ClientsView({ clients, saveClients, colors, allBookings, exportClientsExcel }) {
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

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
    return { visits: visits.length, revenue: visits.reduce((s, b) => s + (b.total || 0), 0) };
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
                  <button className="btn btn-sm" onClick={() => startEdit(c)} style={{ padding: '4px 8px' }}><Edit2 size={12} /></button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(c.id)} style={{ padding: '4px 8px' }}><Trash2 size={12} /></button>
                </div>
              </div>
              {c.phone && <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12} /> <span className="mono">{c.phone}</span></div>}
              {c.address && <div style={{ fontSize: '12px', color: colors.ink + 'BB', display: 'flex', gap: '6px' }}><MapPin size={12} style={{ flexShrink: 0, marginTop: '2px' }} /> <span>{c.address}</span></div>}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: colors.soft }}>{c.defaultRate} AED/hr</span>
                {c.defaultMaterials && <span className="badge" style={{ background: colors.cellMaterials, color: colors.accent }}>w/ materials</span>}
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
              <Field label="Address"><textarea className="input" value={editing.address} onChange={e => setEditing({ ...editing, address: e.target.value })} placeholder="Apt 101 Building, Area" rows="2" style={{ resize: 'vertical' }} /></Field>
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

function PendingView({ allBookings, savedDays, setSavedDays, bookings, setBookings, date, colors, formatDateShort, exportPendingExcel }) {
  const pending = allBookings.filter(b => b.paymentStatus !== 'PAID' && b.total > 0);
  const totalPending = pending.reduce((s, b) => s + b.total, 0);
  const byClient = {};
  pending.forEach(b => {
    const k = b.clientName || 'Unknown';
    if (!byClient[k]) byClient[k] = { name: k, phone: b.phone, items: [], total: 0 };
    byClient[k].items.push(b);
    byClient[k].total += b.total;
  });
  const groups = Object.values(byClient).sort((a, b) => b.total - a.total);

  const markPaid = async (bookingId, bookingDate) => {
    if (bookingDate === date) {
      setBookings(bookings.map(b => b.id === bookingId ? { ...b, paymentStatus: 'PAID' } : b));
    }
    if (savedDays[bookingDate]) {
      const updatedDays = { ...savedDays, [bookingDate]: { ...savedDays[bookingDate], bookings: savedDays[bookingDate].bookings.map(b => b.id === bookingId ? { ...b, paymentStatus: 'PAID' } : b) } };
      setSavedDays(updatedDays);
      try { localStorage.setItem('sparkle_all_days', JSON.stringify(updatedDays)); } catch (e) {}
    }
  };

  const today = new Date().setHours(0, 0, 0, 0);
  const daysOverdue = (d) => Math.floor((today - new Date(d).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Pending Payments</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>{pending.length} unpaid jobs across {groups.length} clients</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {pending.length > 0 && <button className="btn btn-primary" onClick={exportPendingExcel}><FileSpreadsheet size={14} /> Excel</button>}
          <div style={{ padding: '12px 20px', background: pending.length ? '#FEF3C7' : colors.accentLight, border: `1.5px solid ${pending.length ? colors.warning : colors.accent}`, borderRadius: '10px', textAlign: 'right' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: colors.ink + '99', fontWeight: 600 }}>Outstanding</div>
            <div className="display-font" style={{ fontSize: '24px', fontWeight: 800, color: pending.length ? colors.warning : colors.accent }}>{totalPending.toFixed(2)} AED</div>
          </div>
        </div>
      </div>

      {pending.length === 0 ? (
        <div style={{ background: colors.accentLight, borderRadius: '12px', border: `1px solid ${colors.accent}33`, padding: '50px 20px', textAlign: 'center' }}>
          <Check size={48} style={{ color: colors.accent, marginBottom: '12px' }} />
          <h3 className="display-font" style={{ margin: '0 0 6px', color: colors.accent, fontSize: '22px', fontWeight: 700 }}>All paid up!</h3>
          <p style={{ margin: 0, fontSize: '13px', color: colors.ink + '99' }}>No outstanding payments. Mark jobs as PENDING in the bookings tab to track them here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {groups.map(g => (
            <div key={g.name} style={{ background: 'white', border: `1px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', background: colors.soft, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div className="display-font" style={{ fontSize: '17px', fontWeight: 700 }}>{g.name}</div>
                  {g.phone && <div style={{ fontSize: '12px', color: colors.ink + 'AA', marginTop: '2px' }}><Phone size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> <span className="mono">{g.phone}</span></div>}
                </div>
                <div className="display-font" style={{ fontSize: '20px', fontWeight: 700, color: colors.warning }}>{g.total.toFixed(0)} AED owed</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <tbody>
                    {g.items.sort((a, b) => new Date(a.date) - new Date(b.date)).map(b => {
                      const overdue = daysOverdue(b.date);
                      return (
                        <tr key={b.id + '_' + b.date} style={{ borderTop: `1px solid ${colors.border}` }}>
                          <td style={{ padding: '10px 18px' }}>
                            <div style={{ fontWeight: 600 }}>{formatDateShort(b.date)}</div>
                            {overdue > 0 && <div style={{ fontSize: '11px', color: overdue > 7 ? colors.rust : colors.warning, fontWeight: 600 }}>{overdue}d overdue</div>}
                          </td>
                          <td style={{ padding: '10px' }}><span className="badge" style={{ background: colors.soft }}>{b.cleaner}</span></td>
                          <td style={{ padding: '10px', fontSize: '12px' }} className="mono">{b.timing}</td>
                          <td style={{ padding: '10px', fontSize: '12px', color: colors.ink + '99' }}>{b.location}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}><span className="badge" style={{ background: b.paymentType === 'CASH' ? '#FEE2E2' : colors.accentLight, color: b.paymentType === 'CASH' ? colors.rust : colors.accent }}>{b.paymentType}</span></td>
                          <td className="mono" style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: colors.warning }}>{b.total.toFixed(0)}</td>
                          <td style={{ padding: '10px 18px', textAlign: 'right' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => markPaid(b.id, b.date)}><Check size={12} /> Mark Paid</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
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
