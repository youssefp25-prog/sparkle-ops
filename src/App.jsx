import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { Plus, Trash2, FileText, Grid3x3, Download, Printer, Save, RotateCcw, Users, DollarSign, Clock, BookUser, TrendingUp, AlertCircle, Repeat, Search, X, Check, Phone, MapPin, Edit2, ChevronRight, FileSpreadsheet, CalendarDays, Truck, Home, Building2, Navigation, Receipt, Settings, MessageCircle } from 'lucide-react';

const CLEANERS = ['Leah', 'Eva', 'Zainab', 'Roselyn', 'Coline', 'Angel', 'Razelle'];
const PICKUP_TYPES = ['HOME', 'OFFICE'];
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
  const [cleanerHomes, setCleanerHomes] = useState({}); // { Leah: { address, lat, lng }, ... }
  const [officeAddress, setOfficeAddress] = useState({ address: 'Office, Abu Dhabi', lat: 24.4539, lng: 54.3773 });
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

  // ===== LOAD FROM LOCALSTORAGE ON MOUNT =====
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
    try {
      const homesRaw = localStorage.getItem('sparkle_cleaner_homes');
      if (homesRaw) setCleanerHomes(JSON.parse(homesRaw));
    } catch (e) {}
    try {
      const officeRaw = localStorage.getItem('sparkle_office');
      if (officeRaw) setOfficeAddress(JSON.parse(officeRaw));
    } catch (e) {}
    try {
      const companyRaw = localStorage.getItem('sparkle_company');
      if (companyRaw) setCompanyInfo(prev => ({ ...prev, ...JSON.parse(companyRaw) }));
    } catch (e) {}
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

  const loadDate = (d) => {
    setDate(d);
    if (savedDays[d]) setBookings(savedDays[d].bookings);
    else setBookings([emptyBooking()]);
  };

  const saveClients = (next) => {
    setClients(next);
    try { localStorage.setItem('sparkle_clients', JSON.stringify(next)); } catch (e) {}
  };

  const saveContracts = (next) => {
    setContracts(next);
    try { localStorage.setItem('sparkle_contracts', JSON.stringify(next)); } catch (e) {}
  };

  const saveCleanerHomes = (next) => {
    setCleanerHomes(next);
    try { localStorage.setItem('sparkle_cleaner_homes', JSON.stringify(next)); } catch (e) {}
  };

  const saveOfficeAddress = (next) => {
    setOfficeAddress(next);
    try { localStorage.setItem('sparkle_office', JSON.stringify(next)); } catch (e) {}
  };

  const saveCompanyInfo = (next) => {
    setCompanyInfo(next);
    try { localStorage.setItem('sparkle_company', JSON.stringify(next)); } catch (e) {}
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

  const printPage = () => window.print();

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

    // Filter bookings for this month
    const monthBookings = allBookingsWithDate.filter(b => {
      const d = new Date(b.date);
      return d >= monthStart && d <= monthEnd;
    });

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

  const exportEverythingExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Today
    if (bookingsWithCalc.length > 0) {
      const headers = ['DATE', 'CLEANER', 'TIMINGS', 'CLIENT', 'LOCATION', 'PHONE', 'MAT.', 'HRS', 'RATE', 'TOTAL (AED)', 'PAY', 'STATUS'];
      const dayNum = new Date(date).getDate();
      const rows = bookingsWithCalc.map(b => [
        dayNum, b.cleaner, b.timing, b.clientName, b.location, b.phone || '',
        b.withMaterials ? 'Yes' : 'No', Number(b.hours), Number(b.pricePerHour),
        Number(b.total.toFixed(2)), b.paymentType, b.paymentStatus || 'PENDING'
      ]);
      rows.push(['', '', '', '', '', '', 'TOTAL', Number(totalHours.toFixed(1)), '', Number(totalRevenue.toFixed(2)), '', '']);
      const ws = buildStyledSheet('TODAY — DAILY REPORT', formatLongDate(date), headers, rows, [6, 12, 12, 22, 32, 16, 8, 8, 8, 14, 10, 12], {
        totalRow: true, statusCol: 11, materialsCol: 6, priceCol: 9
      });
      XLSX.utils.book_append_sheet(wb, ws, 'Today');
    }

    // Sheet 2: All History
    if (allBookingsWithDate.length > 0) {
      const headers = ['DATE', 'CLEANER', 'TIMINGS', 'CLIENT', 'LOCATION', 'PHONE', 'MAT.', 'HRS', 'RATE', 'TOTAL (AED)', 'PAY', 'STATUS'];
      const rows = allBookingsWithDate.map(b => [
        b.date, b.cleaner, b.timing, b.clientName, b.location, b.phone || '',
        b.withMaterials ? 'Yes' : 'No', Number(b.hours), Number(b.pricePerHour),
        Number((b.total || 0).toFixed(2)), b.paymentType, b.paymentStatus || 'PENDING'
      ]);
      const ws = buildStyledSheet('ALL HISTORY', `${allBookingsWithDate.length} total jobs`, headers, rows, [12, 12, 12, 22, 32, 16, 8, 8, 8, 14, 10, 12], {
        statusCol: 11, materialsCol: 6, priceCol: 9
      });
      XLSX.utils.book_append_sheet(wb, ws, 'History');
    }

    // Sheet 3: Clients
    if (clients.length > 0) {
      const headers = ['NAME', 'PHONE', 'ADDRESS', 'RATE/HR', 'MAT.', 'VISITS', 'TOTAL REVENUE (AED)', 'NOTES'];
      const rows = clients.map(c => {
        const visits = allBookingsWithDate.filter(b => b.clientId === c.id);
        return [
          c.name, c.phone || '', c.address || '', Number(c.defaultRate),
          c.defaultMaterials ? 'Yes' : 'No', visits.length,
          Number(visits.reduce((s, b) => s + (b.total || 0), 0).toFixed(2)), c.notes || ''
        ];
      });
      const ws = buildStyledSheet('CLIENT DATABASE', `${clients.length} clients`, headers, rows, [22, 18, 38, 10, 8, 10, 18, 28], {
        materialsCol: 4, priceCol: 6
      });
      XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    }

    // Sheet 4: Contracts
    if (contracts.length > 0) {
      const headers = ['CLIENT', 'CLEANER', 'DAYS', 'TIMING', 'RATE/HR', 'MAT.', 'PAYMENT', 'STATUS'];
      const rows = contracts.map(c => [
        c.clientName, c.cleaner, c.daysOfWeek.map(d => DAYS[d]).join(', '),
        c.timing, Number(c.pricePerHour), c.withMaterials ? 'Yes' : 'No',
        c.paymentType, c.active ? 'Active' : 'Paused'
      ]);
      const ws = buildStyledSheet('RECURRING CONTRACTS', `${contracts.filter(c => c.active).length} active`, headers, rows, [22, 12, 26, 14, 10, 8, 12, 10], {
        materialsCol: 5, priceCol: 4
      });
      XLSX.utils.book_append_sheet(wb, ws, 'Contracts');
    }

    // Sheet 5: Earnings (all-time)
    const earnHeaders = ['CLEANER', 'JOBS', 'HOURS', 'CLIENTS', 'CASH (AED)', 'ONLINE (AED)', 'TOTAL (AED)'];
    const earnRows = CLEANERS.map(name => {
      const jobs = allBookingsWithDate.filter(b => b.cleaner === name);
      return [
        name, jobs.length,
        Number(jobs.reduce((s, b) => s + (b.hours || 0), 0).toFixed(1)),
        new Set(jobs.map(b => b.clientName)).size,
        Number(jobs.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + (b.total || 0), 0).toFixed(2)),
        Number(jobs.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + (b.total || 0), 0).toFixed(2)),
        Number(jobs.reduce((s, b) => s + (b.total || 0), 0).toFixed(2))
      ];
    });
    earnRows.push([
      'GRAND TOTAL', allBookingsWithDate.length,
      Number(allBookingsWithDate.reduce((s, b) => s + (b.hours || 0), 0).toFixed(1)),
      new Set(allBookingsWithDate.map(b => b.clientName)).size,
      Number(allBookingsWithDate.filter(b => b.paymentType === 'CASH').reduce((s, b) => s + (b.total || 0), 0).toFixed(2)),
      Number(allBookingsWithDate.filter(b => b.paymentType === 'ONLINE').reduce((s, b) => s + (b.total || 0), 0).toFixed(2)),
      Number(allBookingsWithDate.reduce((s, b) => s + (b.total || 0), 0).toFixed(2))
    ]);
    const wsEarn = buildStyledSheet('CLEANER EARNINGS — ALL TIME', `${allBookingsWithDate.length} total jobs`, earnHeaders, earnRows, [16, 8, 10, 10, 14, 14, 14], { totalRow: true, priceCol: 6 });
    XLSX.utils.book_append_sheet(wb, wsEarn, 'Earnings');

    // Sheet 6: Pending
    const pending = allBookingsWithDate.filter(b => b.paymentStatus !== 'PAID' && b.total > 0);
    if (pending.length > 0) {
      const todaySafe = new Date().setHours(0, 0, 0, 0);
      const headers = ['DATE', 'CLIENT', 'PHONE', 'LOCATION', 'CLEANER', 'TIMING', 'AMOUNT (AED)', 'PAY', 'DAYS OVERDUE'];
      const rows = pending.map(b => {
        const overdue = Math.floor((todaySafe - new Date(b.date).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
        return [
          b.date, b.clientName, b.phone || '', b.location, b.cleaner, b.timing,
          Number(b.total.toFixed(2)), b.paymentType, overdue > 0 ? overdue : 0
        ];
      });
      const totalOwed = pending.reduce((s, b) => s + b.total, 0);
      rows.push(['', '', '', '', '', 'TOTAL OWED', Number(totalOwed.toFixed(2)), '', '']);
      const ws = buildStyledSheet('PENDING PAYMENTS', `${pending.length} unpaid · ${totalOwed.toFixed(2)} AED owed`, headers, rows, [12, 22, 18, 32, 14, 12, 14, 10, 14], { totalRow: true, priceCol: 6 });
      XLSX.utils.book_append_sheet(wb, ws, 'Pending');
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
          <button className={`tab ${view === 'monthly' ? 'active' : ''}`} onClick={() => setView('monthly')}><CalendarDays size={15} /> Monthly Report</button>
          <button className={`tab ${view === 'driver' ? 'active' : ''}`} onClick={() => setView('driver')}><Truck size={15} /> Driver</button>
          <button className={`tab ${view === 'invoices' ? 'active' : ''}`} onClick={() => setView('invoices')}><Receipt size={15} /> Invoices</button>
          <button className={`tab ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}><Settings size={15} /> Settings</button>
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
        {view === 'monthly' && <MonthlyView allBookings={allBookingsWithDate} CLEANERS={CLEANERS} colors={colors} exportMonthlyExcel={exportMonthlyExcel} />}
        {view === 'driver' && <DriverView bookingsWithCalc={bookingsWithCalc} date={date} formatDate={formatDate} colors={colors} cleanerHomes={cleanerHomes} saveCleanerHomes={saveCleanerHomes} officeAddress={officeAddress} saveOfficeAddress={saveOfficeAddress} CLEANER_COLORS={CLEANER_COLORS} CLEANERS={CLEANERS} updateBooking={updateBooking} />}
        {view === 'invoices' && <InvoicesView allBookings={allBookingsWithDate} clients={clients} companyInfo={companyInfo} saveCompanyInfo={saveCompanyInfo} colors={colors} />}
        {view === 'settings' && <SettingsView companyInfo={companyInfo} saveCompanyInfo={saveCompanyInfo} colors={colors} />}
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
                      <input className="input" placeholder="Apt 101 Bldg" value={b.location} onChange={e => updateBooking(b.id, 'location', e.target.value)} style={{ marginBottom: '3px', minWidth: '180px' }} />
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
  const filtered = allBookings.filter(b => {
    const d = new Date(b.date);
    return d >= monthStart && d <= monthEnd;
  });

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="display-font" style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Monthly Report</h2>
          <p style={{ margin: '4px 0 0', color: colors.ink + '99', fontSize: '13px' }}>Complete monthly business record · ready to save to OneDrive/Drive</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="select" value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{ width: 'auto' }}>
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
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

function InvoicesView({ allBookings, clients, companyInfo, saveCompanyInfo, colors }) {
  const [mode, setMode] = React.useState('monthly'); // monthly, daily, booking
  const [selectedClient, setSelectedClient] = React.useState('');
  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth());
  const [selectedDate, setSelectedDate] = React.useState(now.toISOString().split('T')[0]);
  const [selectedBooking, setSelectedBooking] = React.useState('');
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

  // Filter bookings based on mode
  const invoiceItems = React.useMemo(() => {
    if (!selectedClient) return [];
    if (mode === 'monthly') {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      return allBookings.filter(b => {
        if (b.clientName !== selectedClient) return false;
        const d = new Date(b.date);
        return d >= monthStart && d <= monthEnd;
      }).sort((a, b) => a.date.localeCompare(b.date));
    }
    if (mode === 'daily') {
      return allBookings.filter(b => b.clientName === selectedClient && b.date === selectedDate);
    }
    if (mode === 'booking') {
      return allBookings.filter(b => b.id == selectedBooking);
    }
    return [];
  }, [mode, selectedClient, year, month, selectedDate, selectedBooking, allBookings]);

  const subtotal = invoiceItems.reduce((s, b) => s + (b.total || 0), 0);
  const totalHours = invoiceItems.reduce((s, b) => s + (b.hours || 0), 0);

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
        <div style={{ display: 'grid', gridTemplateColumns: clientsWithBookings.length > 6 ? 'repeat(auto-fill, minmax(180px, 1fr))' : '1fr', gap: '8px', marginBottom: '20px' }}>
          {clientsWithBookings.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: colors.ink + '66', fontSize: '13px' }}>
              No clients yet. Add bookings on the Bookings tab first.
            </div>
          ) : (
            <select className="select" value={selectedClient} onChange={e => setSelectedClient(e.target.value)} style={{ gridColumn: '1 / -1' }}>
              <option value="">— Pick a client —</option>
              {clientsWithBookings.map(c => <option key={c.name} value={c.name}>{c.name}{c.address ? ` · ${c.address}` : ''}</option>)}
            </select>
          )}
        </div>

        {selectedClient && mode === 'monthly' && (
          <>
            <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>3. Pick the month</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <select className="select" value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{ width: 'auto' }}>
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select className="select" value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ width: 'auto' }}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
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
            <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>3. Pick the booking</h3>
            <select className="select" value={selectedBooking} onChange={e => setSelectedBooking(e.target.value)} style={{ marginBottom: '20px' }}>
              <option value="">— Pick a booking —</option>
              {clientBookings.map(b => (
                <option key={b.id} value={b.id}>{b.date} · {b.timing} · {b.cleaner} · {(b.total || 0).toFixed(2)} AED</option>
              ))}
            </select>
          </>
        )}

        {selectedClient && (
          <>
            <h3 className="display-font" style={{ margin: '0 0 14px', fontSize: '17px', fontWeight: 700 }}>4. Optional notes</h3>
            <textarea className="input" rows="2" placeholder="e.g. Thank you for your continued business" value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} style={{ resize: 'vertical', marginBottom: '20px' }} />

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
    const win = window.open('', '_blank', 'width=900,height=1000');
    win.document.write(`
      <!DOCTYPE html><html><head><title>Invoice ${invoiceNumber}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #1A1A1A; }
        * { box-sizing: border-box; }
      </style>
      </head><body>${printContent}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script></body></html>
    `);
    win.document.close();
  };

  const handleWhatsApp = () => {
    const msg = `Hi ${client?.name || 'Customer'},\n\nHere is your invoice from ${companyInfo.name}:\n\nInvoice #: ${invoiceNumber}\nDate: ${issueDate}\nPeriod: ${periodLabel}\nTotal Hours: ${totalHours}\nAmount: AED ${subtotal.toFixed(2)}\n\n${isPaid ? 'Status: PAID ✓' : 'Please find payment details below.'}\n\nThank you for your business!\n\n${companyInfo.name}\n${companyInfo.phone}`;
    const phone = (client?.phone || '').replace(/[^0-9]/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Build line items - one row per booking
  const lineItems = items.map(b => ({
    description: titleByMode[mode],
    date: new Date(b.date).getDate(),
    hours: b.hours,
    rate: b.pricePerHour,
    materials: b.withMaterials ? 'Yes' : '',
    cleaner: b.cleaner,
    amount: b.total
  }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '95vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="display-font" style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Invoice Preview</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={handlePrint}><Printer size={14} /> Print / Save PDF</button>
            <button className="btn" style={{ background: '#25D366', color: 'white', borderColor: '#25D366' }} onClick={handleWhatsApp}><MessageCircle size={14} /> WhatsApp</button>
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
          />
        </div>
      </div>
    </div>
  );
}

function InvoiceContent({ invoiceNumber, issueDate, client, companyInfo, lineItems, subtotal, totalHours, isPaid, notes, mode, periodLabel }) {
  const accent = '#0F4C3A';
  const paidColor = '#0F4C3A';

  return (
    <div style={{ background: 'white', padding: '32px', border: '1px solid #e5e5e5', borderRadius: '8px', position: 'relative', fontFamily: 'Arial, sans-serif', color: '#1A1A1A', fontSize: '13px' }}>
      {isPaid && (
        <div style={{
          position: 'absolute', top: '120px', right: '40px',
          border: `4px solid ${paidColor}`, color: paidColor,
          padding: '6px 24px', fontSize: '32px', fontWeight: 800,
          letterSpacing: '0.1em', transform: 'rotate(-12deg)',
          opacity: 0.85, fontFamily: 'Arial, sans-serif'
        }}>
          PAID
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: `3px solid ${accent}`, paddingBottom: '14px' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '36px', fontWeight: 800, color: accent, letterSpacing: '-0.02em' }}>INVOICE</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          {companyInfo.logoDataUrl && <img src={companyInfo.logoDataUrl} alt="logo" style={{ maxHeight: '60px', marginBottom: '8px' }} />}
          <div style={{ fontWeight: 700, fontSize: '15px', color: accent, marginBottom: '2px' }}>{companyInfo.name}</div>
          <div style={{ fontSize: '11px', color: '#666', maxWidth: '260px', lineHeight: 1.5 }}>{companyInfo.address}</div>
          <div style={{ fontSize: '11px', color: '#666' }}>📞 {companyInfo.phone}</div>
          <div style={{ fontSize: '11px', color: '#666' }}>✉️ {companyInfo.email}</div>
          {companyInfo.trn && <div style={{ fontSize: '11px', color: '#666' }}>TRN: {companyInfo.trn}</div>}
        </div>
      </div>

      {/* Bill To + Date/Number */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '4px' }}>Bill To:</div>
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '2px' }}>{client?.name}</div>
          <div style={{ fontSize: '12px', color: '#555', lineHeight: 1.5 }}>{client?.address}</div>
          {client?.phone && <div style={{ fontSize: '12px', color: '#555' }}>📞 {client.phone}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Date: </span>
            <span style={{ fontWeight: 700, fontSize: '13px' }}>{issueDate}</span>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Invoice #: </span>
            <span style={{ fontWeight: 700, fontSize: '15px', color: accent }}>{invoiceNumber}</span>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: accent, color: 'white' }}>
            <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '70px' }}>Job Date</th>
            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '60px' }}>Hours</th>
            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '70px' }}>Rate / hr</th>
            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '70px' }}>Materials</th>
            <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '90px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 0 ? '#FAFAFA' : 'white', borderBottom: '1px solid #e5e5e5' }}>
              <td style={{ padding: '8px', verticalAlign: 'top' }}>
                {idx === 0 ? <span style={{ fontWeight: 600 }}>{item.description}</span> : ''}
              </td>
              <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>{item.date}</td>
              <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>{item.hours}</td>
              <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>{item.rate}</td>
              <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>{item.materials}</td>
              <td style={{ padding: '8px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600 }}>{item.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#F0EBE0' }}>
            <td style={{ padding: '8px', fontWeight: 700 }}>Total hours</td>
            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}></td>
            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>{totalHours.toFixed(1)}</td>
            <td colSpan="2" style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>Total</td>
            <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, fontSize: '15px', color: accent, borderTop: `2px solid ${accent}` }}>
              AED {subtotal.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Notes from user */}
      {notes && (
        <div style={{ background: '#FFF8E7', padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '12px', color: '#555', borderLeft: `3px solid ${accent}` }}>
          {notes}
        </div>
      )}

      {/* Thank you */}
      <div style={{ textAlign: 'center', padding: '14px', fontWeight: 700, fontSize: '15px', color: accent, letterSpacing: '0.05em', marginBottom: '14px' }}>
        THANK YOU FOR YOUR BUSINESS!
      </div>

      {/* Bank details */}
      <div style={{ background: '#F0EBE0', padding: '14px', borderRadius: '6px', fontSize: '11px', lineHeight: 1.6 }}>
        <div style={{ fontWeight: 700, color: accent, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Bank Details</div>
        <div><strong>{companyInfo.bankName}</strong></div>
        <div>{companyInfo.bankBranch}</div>
        <div>Account No: <span className="mono">{companyInfo.accountNo}</span></div>
        <div>IBAN: <span className="mono">{companyInfo.iban}</span></div>
        <div>SWIFT: <span className="mono">{companyInfo.swift}</span></div>
        {companyInfo.bankNote && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #d4cfc0', fontSize: '10px', color: '#666', whiteSpace: 'pre-line' }}>
            <strong>Note:</strong> {companyInfo.bankNote}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsView({ companyInfo, saveCompanyInfo, colors }) {
  const [info, setInfo] = React.useState(companyInfo);
  const [savedMsg, setSavedMsg] = React.useState('');

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
