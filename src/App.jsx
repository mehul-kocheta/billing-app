import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Printer, Settings, ArrowLeft, Save, FileText, History, Search, BarChart3, Calendar, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { numberToWords } from './utils.js';
import './index.css';

const ExpandingTextarea = ({ value, onChange, ...props }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);
  return <textarea ref={ref} value={value} onChange={onChange} rows={1} style={{resize: 'none', overflow: 'hidden'}} {...props} />;
};

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function keywordFuzzyScore(search, target) {
  if (!search) return 0;
  const searchWords = search.toLowerCase().split(/\s+/).filter(Boolean);
  const targetWords = target.toLowerCase().split(/\s+/).filter(Boolean);
  
  if (searchWords.length === 0) return 0;

  let totalDistance = 0;
  for (const sw of searchWords) {
    let minD = Infinity;
    for (const tw of targetWords) {
      const d = levenshtein(sw, tw);
      if (d < minD) minD = d;
    }
    totalDistance += minD;
  }
  return totalDistance;
}

const AutocompleteTextarea = ({ value, onChange, onSelect, options, ...props }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [matches, setMatches] = useState([]);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!value || !isOpen) {
      setMatches([]);
      return;
    }
    const scored = options.map(opt => ({
      ...opt,
      score: keywordFuzzyScore(value, opt.product)
    }));
    const maxAllowedScore = value.split(/\s+/).filter(Boolean).length * 4; 
    const filtered = scored.filter(s => s.score <= maxAllowedScore).sort((a, b) => a.score - b.score).slice(0, 6);
    setMatches(filtered);
  }, [value, options, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <ExpandingTextarea
        value={value}
        onChange={(e) => {
          onChange(e);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        {...props}
      />
      {isOpen && matches.length > 0 && (
        <div className="autocomplete-dropdown no-print">
          {matches.map((m) => (
            <div
              key={m.id}
              className="autocomplete-item"
              onClick={() => {
                onSelect(m.product);
                setIsOpen(false);
              }}
            >
              {m.product}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DEFAULT_CONFIG = {
  topMargin: 5,
  companyStateCode: '23',
  companyPan: 'ACHPJ1044Q',
  companyGst: '23ACHPJ1044Q1ZK',
  bankInfo: {
    bank1Name: 'HDFC Bank A/c No. 99999827066916',
    bank1Branch: 'Gol Bazar Branch, Jabalpur IFSC:- HDFC0000224',
    bank2Name: 'Punjab & Sind Bank A/c No. 01041300003092',
    bank2Branch: 'Napier Town Branch, Jabalpur IFSC:- PSIB0000104',
  },
  termsInfo: {
    term1: '1. Invoice must be paid within 15days from date of invoice',
    term2: '2. The design shall be given by the company once flex printed shall not be changed.',
    term3: '3. Interest shall be charged @1.5% p.m. if invoice is not paid within 15days',
    term4: '4. Any complaint about this bill must be received within 10 days from the date of invoice.',
  },
  taxInfo: {
    cgstRate: 9,
    sgstRate: 9,
  },
  productHsnMapping: [
    { id: uuidv4(), product: 'New FL Board with Print', hsn: '3919' },
    { id: uuidv4(), product: 'New S/S BL Board with Print', hsn: '9405' },
    { id: uuidv4(), product: 'New D/S BL Pole Board with Print', hsn: '9405' },
    { id: uuidv4(), product: 'New D/S BL Standee with Print', hsn: '9405' },
    { id: uuidv4(), product: 'Machine Sticker', hsn: '3919' }
  ],
  enableRoundOff: true
};

function getFinancialYear(date) {
  const d = date || new Date();
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  if (month >= 3) { // April onwards
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

function getNextInvoiceNo(historyData) {
  const fy = getFinancialYear();
  let maxNum = 0;
  for (const rec of historyData) {
    const invNo = rec.invoiceData?.invoiceNo || '';
    const match = invNo.match(/^(\d+)\s*\//);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const next = String(maxNum + 1).padStart(3, '0');
  return `${next}/${fy}`;
}

function parseSizeToSqFt(sizeStr) {
  if (!sizeStr) return 0;
  const parts = sizeStr.toLowerCase().split('x');
  if (parts.length !== 2) return 0;

  const parsePart = (str) => {
    str = str.trim();
    if (!str) return 0;
    
    if (str.includes('"')) {
      return parseFloat(str.replace('"', '')) / 12;
    }
    if (str.includes("'")) {
      return parseFloat(str.replace("'", ''));
    }
    return parseFloat(str) || 0;
  };

  const p1 = parsePart(parts[0]);
  const p2 = parsePart(parts[1]);
  return p1 * p2;
}

function App() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [historyData, setHistoryData] = useState([]);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [allHistoryForReport, setAllHistoryForReport] = useState([]);
  const HISTORY_LIMIT = 15;
  const [currentView, setCurrentView] = useState('invoice'); // 'invoice' | 'settings' | 'history' | 'gst-report'
  const [gstTab, setGstTab] = useState('b2b'); // 'b2b' | 'b2c' | 'credit-notes' | 'hsn'
  const [searchQuery, setSearchQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const todayInit = new Date();
  const monthStartInit = new Date(todayInit.getFullYear(), todayInit.getMonth(), 1);
  const [reportFrom, setReportFrom] = useState(`${String(monthStartInit.getDate()).padStart(2,'0')}.${String(monthStartInit.getMonth()+1).padStart(2,'0')}.${monthStartInit.getFullYear()}`);
  const [reportTo, setReportTo] = useState(`${String(todayInit.getDate()).padStart(2,'0')}.${String(todayInit.getMonth()+1).padStart(2,'0')}.${todayInit.getFullYear()}`);
  const toastTimer = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(''), 3000);
  };

  // Invoice Data
  const [invoiceData, setInvoiceData] = useState({
    billToName: 'Ramani Ice-Cream & Co. Ltd.',
    billToAddress: 'Bhateja Parisar, Behind BPCL Petrol Pump\nMaharajpur, Jabalpur (M.P.)',
    billToPin: '482004',
    billToGst: '23AABCR4589H1Z8',
    billToState: 'Madhya Pradesh',
    billToStateCode: '23',
    invoiceNo: '007/2026-2027',
    invoiceDate: '07.04.2026',
    orderNo: '',
    documentType: 'invoice', // 'invoice' | 'credit-note'
    referenceInvoiceNo: '',
  });

  const [items, setItems] = useState([
    { id: uuidv4(), type: 'title', name: 'Supply of FL & BL Boards' },
    { id: uuidv4(), type: 'title', name: 'For Sagar (WOD296)' },
    { id: uuidv4(), type: 'item', name: 'New FL Board with Print', hsn: '3919', size: "6'x3'", sqft: 540, qty: 30, rate: 41 },
  ]);

  const [transportation, setTransportation] = useState([
    { id: uuidv4(), description: 'Transportation Charges from Jabalpur to Sagar Jabalpur', amount: 20375 }
  ]);

  useEffect(() => {
    const loadData = async () => {
      let savedConfig = null;

      if (window.electronAPI) {
        savedConfig = await window.electronAPI.readConfig();
      } else {
        try {
          const localConfig = localStorage.getItem('billing_config');
          if (localConfig) savedConfig = JSON.parse(localConfig);
          const localHistory = localStorage.getItem('billing_history');
          if (localHistory) setHistoryData(JSON.parse(localHistory));
        } catch (e) {
          console.error("Failed to read from localStorage", e);
        }
      }

      if (savedConfig) {
        // Object format migration for mappings if needed
        if (savedConfig.productHsnMapping && !Array.isArray(savedConfig.productHsnMapping)) {
           savedConfig.productHsnMapping = Object.entries(savedConfig.productHsnMapping).map(([k,v]) => ({id: uuidv4(), product: k, hsn: v}));
        }
        const merged = { ...DEFAULT_CONFIG };
        for (let key in savedConfig) {
           if (typeof savedConfig[key] === 'object' && savedConfig[key] !== null && !Array.isArray(savedConfig[key])) {
               merged[key] = { ...merged[key], ...savedConfig[key] };
           } else {
               merged[key] = savedConfig[key];
           }
        }
        setConfig(merged);
      }
      
      setLoaded(true);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (currentView === 'history' && window.electronAPI) {
      const fetchPage = async () => {
         const res = await window.electronAPI.getHistoryPage(searchQuery, historyCurrentPage, HISTORY_LIMIT);
         if (res && res.success) {
           setHistoryData(res.data);
           setHistoryTotalPages(Math.ceil(res.totalCount / HISTORY_LIMIT) || 1);
         }
      };
      const timeout = setTimeout(fetchPage, 300);
      return () => clearTimeout(timeout);
    }
  }, [currentView, searchQuery, historyCurrentPage]);

  useEffect(() => {
    if (currentView === 'gst-report' && window.electronAPI) {
      window.electronAPI.getAllHistory().then(data => setAllHistoryForReport(data));
    }
  }, [currentView]);

  const deleteInvoice = async (id) => {
    if (window.confirm("Are you sure you want to delete this invoice?")) {
       if (window.electronAPI) {
         await window.electronAPI.deleteInvoice(id);
         const res = await window.electronAPI.getHistoryPage(searchQuery, historyCurrentPage, HISTORY_LIMIT);
         if (res && res.success) {
           setHistoryData(res.data);
           setHistoryTotalPages(Math.ceil(res.totalCount / HISTORY_LIMIT) || 1);
         }
       } else {
         const newHistory = historyData.filter(h => h.id !== id);
         setHistoryData(newHistory);
         localStorage.setItem('billing_history', JSON.stringify(newHistory));
       }
       showToast('Invoice deleted!');
    }
  };

  useEffect(() => {
    if (loaded) {
      if (window.electronAPI) {
        window.electronAPI.writeConfig(config);
      } else {
        localStorage.setItem('billing_config', JSON.stringify(config));
      }
    }
  }, [config, loaded]);

  const handleConfigChange = (section, field, value) => {
    setConfig(prev => {
      if (section) {
         return { ...prev, [section]: { ...prev[section], [field]: value } };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleMappingChange = (id, field, value) => {
    setConfig(prev => ({
      ...prev,
      productHsnMapping: prev.productHsnMapping.map(m => m.id === id ? { ...m, [field]: value } : m)
    }));
  };

  const addMapping = () => {
    setConfig(prev => ({
      ...prev,
      productHsnMapping: [...prev.productHsnMapping, { id: uuidv4(), product: '', hsn: '' }]
    }));
  };

  const removeMapping = (id) => {
    setConfig(prev => ({
      ...prev,
      productHsnMapping: prev.productHsnMapping.filter(m => m.id !== id)
    }));
  };

  const handleInvoiceChange = (field, value) => {
    setInvoiceData(prev => ({ ...prev, [field]: value }));
  };

  const getHsnForProduct = (prodName) => {
    const mapping = config.productHsnMapping.find(m => m.product === prodName);
    return mapping ? mapping.hsn : '';
  };

  const handleItemChange = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newItem = { ...item, [field]: value };
        
        // Auto-fill HSN
        if (field === 'name' && getHsnForProduct(value) && item.type === 'item') {
          newItem.hsn = getHsnForProduct(value);
        }

        // Auto-calculate SqFt if size or qty changes
        if ((field === 'size' || field === 'qty') && item.type === 'item') {
          const unitArea = parseSizeToSqFt(newItem.size);
          if (unitArea > 0) {
            newItem.sqft = parseFloat((unitArea * newItem.qty).toFixed(2));
          }
        }
        
        return newItem;
      }
      return item;
    }));
  };

  const addItem = () => {
    setItems(prev => [...prev, { id: uuidv4(), type: 'item', name: '', hsn: '', size: '', sqft: 0, qty: 1, rate: 0 }]);
  };

  const addTitle = () => {
    setItems(prev => [...prev, { id: uuidv4(), type: 'title', name: '' }]);
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const addTransport = () => {
    setTransportation(prev => [...prev, { id: uuidv4(), description: '', amount: 0 }]);
  };

  const removeTransport = (id) => {
    setTransportation(prev => prev.filter(t => t.id !== id));
  };

  const handleTransportChange = (id, field, value) => {
    setTransportation(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const printDocument = () => {
    if (window.electronAPI) {
      window.electronAPI.printToPdf();
    } else {
      window.print();
    }
  };

  const newBill = async () => {
    let nextNo = '';
    if (window.electronAPI) {
       const all = await window.electronAPI.getAllHistory();
       nextNo = getNextInvoiceNo(all);
    } else {
       nextNo = getNextInvoiceNo(historyData);
    }
    setInvoiceData({
      billToName: '',
      billToAddress: '',
      billToPin: '',
      billToGst: '',
      billToState: '',
      billToStateCode: '',
      invoiceNo: nextNo,
      invoiceDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '.'),
      orderNo: '',
      documentType: 'invoice',
      referenceInvoiceNo: '',
    });
    setItems([{ id: uuidv4(), type: 'item', name: '', hsn: '', size: '', sqft: 0, qty: 1, rate: 0 }]);
    setTransportation([]);
  };

  // Calculations
  const calculateItemTotal = (item) => {
    if (item.type === 'title') return 0;
    if (item.sqft > 0) {
      return item.sqft * item.rate;
    }
    return item.qty * item.rate;
  };

  const itemsTotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const transportTotal = transportation.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const taxableValue = itemsTotal + transportTotal;

  // IGST detection: inter-state if billToStateCode differs from company's
  const isInterState = invoiceData.billToStateCode && config.companyStateCode && invoiceData.billToStateCode !== config.companyStateCode;
  const cgstRate = config.taxInfo.cgstRate || 0;
  const sgstRate = config.taxInfo.sgstRate || 0;
  const igstRate = cgstRate + sgstRate;
  const cgst = isInterState ? 0 : taxableValue * (cgstRate / 100);
  const sgst = isInterState ? 0 : taxableValue * (sgstRate / 100);
  const igst = isInterState ? taxableValue * (igstRate / 100) : 0;
  const totalAfterTax = taxableValue + cgst + sgst + igst;
  const isRoundOff = config.enableRoundOff !== false;
  const roundedTotal = isRoundOff ? Math.round(totalAfterTax) : totalAfterTax;
  const roundOff = isRoundOff ? roundedTotal - totalAfterTax : 0;

  const saveToHistory = async () => {
    const invoiceKey = invoiceData.invoiceNo?.trim();
    const newBillRec = {
      id: uuidv4(),
      timestamp: Date.now(),
      totalAmount: roundedTotal,
      invoiceData,
      items,
      transportation,
      taxBreakdown: {
        taxableValue,
        cgst,
        sgst,
        igst,
        isInterState
      }
    };

    if (window.electronAPI) {
      await window.electronAPI.saveInvoice(newBillRec);
      showToast('Invoice saved successfully!');
    } else {
      let newHistory;
      const existingIdx = invoiceKey ? historyData.findIndex(h => h.invoiceData?.invoiceNo?.trim() === invoiceKey) : -1;
      if (existingIdx >= 0) {
        newHistory = [...historyData];
        newHistory[existingIdx] = { ...newBillRec, id: historyData[existingIdx].id };
      } else {
        newHistory = [newBillRec, ...historyData];
      }
      setHistoryData(newHistory);
      localStorage.setItem('billing_history', JSON.stringify(newHistory));
      showToast('Invoice saved locally!');
    }
  };

  const loadFromHistory = (rec) => {
    const cloned = JSON.parse(JSON.stringify(rec));
    setInvoiceData({
      billToName: '',
      billToAddress: '',
      billToPin: '',
      billToGst: '',
      billToState: '',
      billToStateCode: '',
      invoiceNo: '',
      invoiceDate: '',
      orderNo: '',
      documentType: 'invoice',
      referenceInvoiceNo: '',
      ...cloned.invoiceData
    });
    setItems((cloned.items || []).map(item => ({ ...item, type: item.type || 'item', id: uuidv4() })));
    setTransportation((cloned.transportation || []).map(t => ({ ...t, id: uuidv4() })));
    setCurrentView('invoice');
  };

  if (!loaded) return <div>Loading...</div>;

  if (currentView === 'settings') {
    return (
      <div className="app-container">
        <div className="header-actions" style={{justifyContent: 'flex-start'}}>
          <button onClick={() => setCurrentView('invoice')} className="btn">
            <ArrowLeft size={18} /> Back to Invoice
          </button>
        </div>

        <div className="settings-page">
          <h2>Application Settings</h2>
          
          <div className="settings-section mt-4">
            <h3>Layout Configuration</h3>
            <p>Adjust the top margin to leave space for your pre-printed letterhead.</p>
            <div className="flex-row items-center" style={{marginTop: 10, gap: 10}}>
              <label>Top Margin (cm):</label>
              <input 
                type="number" 
                className="input-field border" 
                style={{width: 80}}
                value={config.topMargin} 
                onChange={e => handleConfigChange(null, 'topMargin', parseFloat(e.target.value) || 0)} 
              />
            </div>
          </div>

          <div className="settings-section mt-4">
            <h3>Company Details</h3>
            <p>Your company's state code, PAN and GSTN details displayed on the invoice.</p>
            <div className="flex-row items-center" style={{marginTop: 10, gap: 10}}>
              <label style={{width: 80}}>State Code:</label>
              <input 
                className="input-field border" 
                style={{width: 80}}
                value={config.companyStateCode} 
                onChange={e => handleConfigChange(null, 'companyStateCode', e.target.value)} 
              />
            </div>
            <div className="flex-row items-center" style={{marginTop: 10, gap: 10}}>
              <label style={{width: 80}}>PAN No.:</label>
              <input 
                className="input-field border" 
                style={{width: 150}}
                value={config.companyPan || ''} 
                onChange={e => handleConfigChange(null, 'companyPan', e.target.value)} 
              />
            </div>
            <div className="flex-row items-center" style={{marginTop: 10, gap: 10}}>
              <label style={{width: 80}}>GSTN:</label>
              <input 
                className="input-field border" 
                style={{width: 200}}
                value={config.companyGst || ''} 
                onChange={e => handleConfigChange(null, 'companyGst', e.target.value)} 
              />
            </div>
          </div>

          <div className="settings-section mt-4">
            <h3>Product to HSN Mapping</h3>
            <p>Edit mappings so HSN codes auto-fill when you type a product name.</p>
            <div className="mapping-list">
              {config.productHsnMapping.map((m) => (
                <div key={m.id} className="mapping-row flex items-center mb-2">
                  <input 
                    value={m.product} 
                    onChange={e => handleMappingChange(m.id, 'product', e.target.value)} 
                    className="input-field border w-1/2" 
                    placeholder="Product Name"
                  />
                  <input 
                    value={m.hsn} 
                    onChange={e => handleMappingChange(m.id, 'hsn', e.target.value)} 
                    className="input-field border w-1/3 ml-2" 
                    placeholder="HSN Code"
                  />
                  <button onClick={() => removeMapping(m.id)} className="btn icon-btn text-red ml-2"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
            <button onClick={addMapping} className="btn mt-2"><Plus size={16}/> Add Mapping Row</button>
          </div>

        </div>
      </div>
    );
  }

  if (currentView === 'history') {
    const filtered = window.electronAPI ? historyData : historyData.filter(h => {
       const search = searchQuery.toLowerCase();
       const d = h.invoiceData;
       return (d.billToName && d.billToName.toLowerCase().includes(search)) ||
              (d.billToAddress && d.billToAddress.toLowerCase().includes(search)) ||
              (d.invoiceDate && d.invoiceDate.includes(search)) ||
              (d.invoiceNo && d.invoiceNo.toLowerCase().includes(search)) ||
              (d.documentType === 'credit-note' && 'credit note'.includes(search)) ||
              (d.referenceInvoiceNo && d.referenceInvoiceNo.toLowerCase().includes(search));
    });

    return (
      <div className="app-container">
        <div className="header-actions" style={{justifyContent: 'flex-start'}}>
          <button onClick={() => setCurrentView('invoice')} className="btn">
            <ArrowLeft size={18} /> Back to Invoice
          </button>
        </div>
        <div className="history-page">
          <h2>Invoice History</h2>
          <div className="search-bar mt-4 flex items-center">
             <Search size={18} className="mr-2 text-gray-500" />
             <input 
                className="input-field border flex-grow p-2" 
                placeholder="Search by name, address, date, or invoice no..." 
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setHistoryCurrentPage(1);
                }}
             />
          </div>
          <div className="history-list mt-4">
             {filtered.length === 0 ? <p className="mt-4">No invoices found.</p> : null}
             {filtered.map(rec => {
                const isCreditNote = rec.invoiceData?.documentType === 'credit-note';
                const hasGst = !!(rec.invoiceData?.billToGst?.trim());
                return (
                <div key={rec.id} className="history-card border p-4 mb-4 rounded bg-white shadow-sm flex justify-between items-center">
                   <div>
                      <h3 className="font-bold">
                        {rec.invoiceData.billToName || 'Unnamed Client'}
                        {isCreditNote && <span className="badge badge-credit-note ml-2">Credit Note</span>}
                        {!isCreditNote && !hasGst && <span className="badge badge-b2c ml-2">B2C</span>}
                      </h3>
                      <p className="text-sm text-gray-600">{rec.invoiceData.billToAddress}</p>
                      <p className="text-sm mt-1">
                        <strong>{isCreditNote ? 'CN No:' : 'Inv No:'}</strong> {rec.invoiceData.invoiceNo} | <strong>Date:</strong> {rec.invoiceData.invoiceDate}
                        {isCreditNote && rec.invoiceData.referenceInvoiceNo && (
                          <> | <strong>Ref:</strong> {rec.invoiceData.referenceInvoiceNo}</>)}
                      </p>
                   </div>
                   <div className="text-right flex items-center justify-end gap-4">
                      <p className="font-bold text-lg">Rs. {rec.totalAmount}</p>
                      <button onClick={() => loadFromHistory(rec)} className="btn primary">Load</button>
                      <button onClick={() => deleteInvoice(rec.id)} className="btn icon-btn text-red p-2 border rounded"><Trash2 size={16}/></button>
                   </div>
                </div>
                );
             })}
          </div>
          {window.electronAPI && historyTotalPages > 1 && (
            <div className="flex justify-between items-center mt-4 p-4 border-t">
               <button 
                  className="btn" 
                  disabled={historyCurrentPage <= 1} 
                  onClick={() => setHistoryCurrentPage(p => Math.max(1, p - 1))}
               >
                 Previous
               </button>
               <span>Page {historyCurrentPage} of {historyTotalPages}</span>
               <button 
                  className="btn" 
                  disabled={historyCurrentPage >= historyTotalPages} 
                  onClick={() => setHistoryCurrentPage(p => Math.min(historyTotalPages, p + 1))}
               >
                 Next
               </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentView === 'gst-report') {
    const parseInvoiceDate = (dateStr) => {
      if (!dateStr) return null;
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
      return null;
    };

    const fromDate = parseInvoiceDate(reportFrom);
    const toDate = parseInvoiceDate(reportTo);

    const filteredRecs = (window.electronAPI ? allHistoryForReport : historyData).filter(rec => {
      const d = parseInvoiceDate(rec.invoiceData?.invoiceDate);
      if (!d || !fromDate || !toDate) return false;
      return d >= fromDate && d <= toDate;
    });

    let totalSales = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;
    for (const rec of filteredRecs) {
      if (rec.taxBreakdown) {
        totalSales += rec.taxBreakdown.taxableValue || 0;
        totalCgst += rec.taxBreakdown.cgst || 0;
        totalSgst += rec.taxBreakdown.sgst || 0;
        totalIgst += rec.taxBreakdown.igst || 0;
      } else {
        const recItems = rec.items || [];
        const recTransport = rec.transportation || [];
        const recItemsTotal = recItems.reduce((s, it) => {
          if (it.type === 'title') return s;
          return s + (it.sqft > 0 ? it.sqft * it.rate : it.qty * it.rate);
        }, 0);
        const recTransTotal = recTransport.reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const recTaxable = recItemsTotal + recTransTotal;
        const recStateCode = rec.invoiceData?.billToStateCode;
        const recIsInter = recStateCode && config.companyStateCode && recStateCode !== config.companyStateCode;
        totalSales += recTaxable;
        if (recIsInter) {
          totalIgst += recTaxable * ((config.taxInfo.cgstRate + config.taxInfo.sgstRate) / 100);
        } else {
          totalCgst += recTaxable * (config.taxInfo.cgstRate / 100);
          totalSgst += recTaxable * (config.taxInfo.sgstRate / 100);
        }
      }
    }
    const grandTotal = totalSales + totalCgst + totalSgst + totalIgst;

    const hsnTotals = {};
    for (const rec of filteredRecs) {
      const isInterState = rec.taxBreakdown ? rec.taxBreakdown.isInterState : (rec.invoiceData?.billToStateCode && config.companyStateCode && rec.invoiceData?.billToStateCode !== config.companyStateCode);
      
      const cgstRate = config.taxInfo.cgstRate || 0;
      const sgstRate = config.taxInfo.sgstRate || 0;
      const igstRate = cgstRate + sgstRate;

      for(const item of rec.items || []) {
         if (item.type === 'title') continue;
         const hsn = item.hsn || 'No HSN';
         const taxable = item.sqft > 0 ? item.sqft * item.rate : item.qty * item.rate;
         if (!hsnTotals[hsn]) hsnTotals[hsn] = { hsn, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
         
         const itemCgst = isInterState ? 0 : taxable * (cgstRate / 100);
         const itemSgst = isInterState ? 0 : taxable * (sgstRate / 100);
         const itemIgst = isInterState ? taxable * (igstRate / 100) : 0;
         
         hsnTotals[hsn].taxable += taxable;
         hsnTotals[hsn].cgst += itemCgst;
         hsnTotals[hsn].sgst += itemSgst;
         hsnTotals[hsn].igst += itemIgst;
         hsnTotals[hsn].total += (taxable + itemCgst + itemSgst + itemIgst);
      }
      
      const transTotal = (rec.transportation || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);
      if (transTotal > 0) {
         const hsn = 'Transport';
         if (!hsnTotals[hsn]) hsnTotals[hsn] = { hsn, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
         const itemCgst = isInterState ? 0 : transTotal * (cgstRate / 100);
         const itemSgst = isInterState ? 0 : transTotal * (sgstRate / 100);
         const itemIgst = isInterState ? transTotal * (igstRate / 100) : 0;
         hsnTotals[hsn].taxable += transTotal;
         hsnTotals[hsn].cgst += itemCgst;
         hsnTotals[hsn].sgst += itemSgst;
         hsnTotals[hsn].igst += itemIgst;
         hsnTotals[hsn].total += (transTotal + itemCgst + itemSgst + itemIgst);
      }
    }
    const hsnData = Object.values(hsnTotals);

    // Split records into B2B, B2C, Credit Notes
    const b2bRecs = filteredRecs.filter(r => r.invoiceData?.documentType !== 'credit-note' && !!(r.invoiceData?.billToGst?.trim()));
    const b2cRecs = filteredRecs.filter(r => r.invoiceData?.documentType !== 'credit-note' && !(r.invoiceData?.billToGst?.trim()));
    const cnRecs = filteredRecs.filter(r => r.invoiceData?.documentType === 'credit-note');

    const exportToExcel = () => {
      // Summary sheet data
      const summaryData = [
        { Description: 'Total Taxable Value (Sales)', 'Amount (₹)': parseFloat(totalSales.toFixed(2)) },
        { Description: 'Total CGST Collected', 'Amount (₹)': parseFloat(totalCgst.toFixed(2)) },
        { Description: 'Total SGST Collected', 'Amount (₹)': parseFloat(totalSgst.toFixed(2)) },
        { Description: 'Total IGST Collected', 'Amount (₹)': parseFloat(totalIgst.toFixed(2)) },
        { Description: 'Grand Total (Sales + Tax)', 'Amount (₹)': parseFloat(grandTotal.toFixed(2)) },
      ];

      const makeBreakdownData = (recs, isCN) => recs.map(rec => {
        const tb = rec.taxBreakdown || {};
        const row = {
          [isCN ? 'CN No.' : 'Inv No.']: rec.invoiceData?.invoiceNo || '',
          'Date': rec.invoiceData?.invoiceDate || '',
          'Client': rec.invoiceData?.billToName || '',
          'GST No.': rec.invoiceData?.billToGst || '',
          'Taxable': parseFloat((tb.taxableValue || 0).toFixed(2)),
          'CGST': parseFloat((tb.cgst || 0).toFixed(2)),
          'SGST': parseFloat((tb.sgst || 0).toFixed(2)),
          'IGST': parseFloat((tb.igst || 0).toFixed(2)),
          'Total': parseFloat((rec.totalAmount || 0).toFixed(2)),
        };
        if (isCN) {
          row['Ref Invoice'] = rec.invoiceData?.referenceInvoiceNo || '';
        }
        return row;
      });

      const invCols = [
        { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 20 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }
      ];
      const cnCols = [...invCols, { wch: 18 }];

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary['!cols'] = [{ wch: 35 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'GST Summary');

      if (b2bRecs.length > 0) {
        const wsB2B = XLSX.utils.json_to_sheet(makeBreakdownData(b2bRecs, false));
        wsB2B['!cols'] = invCols;
        XLSX.utils.book_append_sheet(wb, wsB2B, 'B2B Invoices');
      }

      if (b2cRecs.length > 0) {
        const wsB2C = XLSX.utils.json_to_sheet(makeBreakdownData(b2cRecs, false));
        wsB2C['!cols'] = invCols;
        XLSX.utils.book_append_sheet(wb, wsB2C, 'B2C Invoices');
      }

      if (cnRecs.length > 0) {
        const wsCN = XLSX.utils.json_to_sheet(makeBreakdownData(cnRecs, true));
        wsCN['!cols'] = cnCols;
        XLSX.utils.book_append_sheet(wb, wsCN, 'Credit Notes');
      }

      if (hsnData.length > 0) {
        const hsnExportData = hsnData.map(h => ({
          'HSN Code': h.hsn,
          'Taxable': parseFloat(h.taxable.toFixed(2)),
          'CGST': parseFloat(h.cgst.toFixed(2)),
          'SGST': parseFloat(h.sgst.toFixed(2)),
          'IGST': parseFloat(h.igst.toFixed(2)),
          'Total': parseFloat(h.total.toFixed(2)),
        }));
        const wsHsn = XLSX.utils.json_to_sheet(hsnExportData);
        wsHsn['!cols'] = [
          { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(wb, wsHsn, 'HSN Breakdown');
      }

      const fileName = `GST_Report_${reportFrom.replace(/\./g, '-')}_to_${reportTo.replace(/\./g, '-')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast('Excel file exported successfully!');
    };

    return (
      <div className="app-container">
        <div className="header-actions" style={{justifyContent: 'flex-start', gap: 12}}>
          <button onClick={() => setCurrentView('invoice')} className="btn">
            <ArrowLeft size={18} /> Back to Invoice
          </button>
          <button onClick={exportToExcel} className="btn primary" style={{marginLeft: 'auto'}}>
            <Download size={18} /> Export to Excel
          </button>
        </div>
        <div className="settings-page">
          <h2><BarChart3 size={22} style={{display:'inline', verticalAlign:'middle', marginRight: 8}} />GST Summary Report</h2>
          <p className="text-sm mt-2" style={{color: '#6b7280'}}>Filter by invoice date range to calculate totals for GST portal submission.</p>
          
          <div className="flex items-center gap-4 mt-4" style={{flexWrap: 'wrap'}}>
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <label className="font-bold">From:</label>
              <input 
                className="input-field border p-2" 
                style={{width: 140}}
                value={reportFrom} 
                onChange={e => setReportFrom(e.target.value)} 
                placeholder="DD.MM.YYYY"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <label className="font-bold">To:</label>
              <input 
                className="input-field border p-2" 
                style={{width: 140}}
                value={reportTo} 
                onChange={e => setReportTo(e.target.value)} 
                placeholder="DD.MM.YYYY"
              />
            </div>
            <span className="text-sm" style={{color: '#6b7280'}}>({filteredRecs.length} invoice{filteredRecs.length !== 1 ? 's' : ''} found)</span>
          </div>

          <table className="gst-report-table mt-4">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Taxable Value (Sales)</td>
                <td className="text-right">{totalSales.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Total CGST Collected</td>
                <td className="text-right">{totalCgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Total SGST Collected</td>
                <td className="text-right">{totalSgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Total IGST Collected</td>
                <td className="text-right">{totalIgst.toFixed(2)}</td>
              </tr>
              <tr className="font-bold" style={{borderTop: '2px solid #000'}}>
                <td>Grand Total (Sales + Tax)</td>
                <td className="text-right">{grandTotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {filteredRecs.length > 0 && (
            <div className="mt-4">
              <div className="gst-tab-bar">
                <button 
                  className={gstTab === 'b2b' ? 'active-tab' : ''}
                  onClick={() => setGstTab('b2b')}
                >
                  B2B ({b2bRecs.length})
                </button>
                <button 
                  className={gstTab === 'b2c' ? 'active-tab' : ''}
                  onClick={() => setGstTab('b2c')}
                >
                  B2C ({b2cRecs.length})
                </button>
                <button 
                  className={gstTab === 'credit-notes' ? 'active-tab' : ''}
                  onClick={() => setGstTab('credit-notes')}
                >
                  Credit Notes ({cnRecs.length})
                </button>
                <button 
                  className={gstTab === 'hsn' ? 'active-tab' : ''}
                  onClick={() => setGstTab('hsn')}
                >
                  HSN Code Wise
                </button>
              </div>

              {(gstTab === 'b2b' || gstTab === 'b2c') && (
              <div className="gst-table-wrapper">
                <table className="gst-report-table gst-breakdown-table">
                  <thead>
                    <tr>
                      <th style={{width: '10%', minWidth: 90}}>Inv No.</th>
                      <th style={{width: '10%', minWidth: 100}}>Date</th>
                      <th style={{width: '20%', minWidth: 150}}>Client</th>
                      <th style={{width: '16%', minWidth: 140}}>GST No.</th>
                      <th className="text-right" style={{width: '10%', minWidth: 90}}>Taxable</th>
                      <th className="text-right" style={{width: '8%', minWidth: 80}}>CGST</th>
                      <th className="text-right" style={{width: '8%', minWidth: 80}}>SGST</th>
                      <th className="text-right" style={{width: '8%', minWidth: 80}}>IGST</th>
                      <th className="text-right" style={{width: '10%', minWidth: 90}}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(gstTab === 'b2b' ? b2bRecs : b2cRecs).map(rec => {
                      const tb = rec.taxBreakdown || {};
                      return (
                        <tr key={rec.id}>
                          <td>{rec.invoiceData?.invoiceNo}</td>
                          <td>{rec.invoiceData?.invoiceDate}</td>
                          <td className="gst-cell-wrap">{rec.invoiceData?.billToName}</td>
                          <td className="gst-cell-mono">{rec.invoiceData?.billToGst || '—'}</td>
                          <td className="text-right">{(tb.taxableValue || 0).toFixed(2)}</td>
                          <td className="text-right">{(tb.cgst || 0).toFixed(2)}</td>
                          <td className="text-right">{(tb.sgst || 0).toFixed(2)}</td>
                          <td className="text-right">{(tb.igst || 0).toFixed(2)}</td>
                          <td className="text-right font-bold">{(rec.totalAmount || 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {(gstTab === 'b2b' ? b2bRecs : b2cRecs).length === 0 && (
                      <tr><td colSpan={9} className="text-center" style={{padding: 20, color: '#6b7280'}}>No {gstTab === 'b2b' ? 'B2B' : 'B2C'} invoices in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              )}

              {gstTab === 'credit-notes' && (
              <div className="gst-table-wrapper">
                <table className="gst-report-table gst-breakdown-table">
                  <thead>
                    <tr>
                      <th style={{width: '10%', minWidth: 90}}>CN No.</th>
                      <th style={{width: '10%', minWidth: 90}}>Ref Inv.</th>
                      <th style={{width: '10%', minWidth: 100}}>Date</th>
                      <th style={{width: '16%', minWidth: 150}}>Client</th>
                      <th style={{width: '12%', minWidth: 140}}>GST No.</th>
                      <th className="text-right" style={{width: '10%', minWidth: 80}}>Taxable</th>
                      <th className="text-right" style={{width: '8%', minWidth: 70}}>CGST</th>
                      <th className="text-right" style={{width: '8%', minWidth: 70}}>SGST</th>
                      <th className="text-right" style={{width: '8%', minWidth: 70}}>IGST</th>
                      <th className="text-right" style={{width: '8%', minWidth: 80}}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cnRecs.map(rec => {
                      const tb = rec.taxBreakdown || {};
                      return (
                        <tr key={rec.id}>
                          <td>{rec.invoiceData?.invoiceNo}</td>
                          <td>{rec.invoiceData?.referenceInvoiceNo || '—'}</td>
                          <td>{rec.invoiceData?.invoiceDate}</td>
                          <td className="gst-cell-wrap">{rec.invoiceData?.billToName}</td>
                          <td className="gst-cell-mono">{rec.invoiceData?.billToGst || '—'}</td>
                          <td className="text-right">{(tb.taxableValue || 0).toFixed(2)}</td>
                          <td className="text-right">{(tb.cgst || 0).toFixed(2)}</td>
                          <td className="text-right">{(tb.sgst || 0).toFixed(2)}</td>
                          <td className="text-right">{(tb.igst || 0).toFixed(2)}</td>
                          <td className="text-right font-bold">{(rec.totalAmount || 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    {cnRecs.length === 0 && (
                      <tr><td colSpan={10} className="text-center" style={{padding: 20, color: '#6b7280'}}>No credit notes in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              )}

              {gstTab === 'hsn' && (
              <div className="gst-table-wrapper">
                <table className="gst-report-table gst-breakdown-table">
                  <thead>
                    <tr>
                      <th style={{width: '20%'}}>HSN Code</th>
                      <th className="text-right" style={{width: '16%'}}>Taxable</th>
                      <th className="text-right" style={{width: '16%'}}>CGST</th>
                      <th className="text-right" style={{width: '16%'}}>SGST</th>
                      <th className="text-right" style={{width: '16%'}}>IGST</th>
                      <th className="text-right" style={{width: '16%'}}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hsnData.map((h, i) => (
                      <tr key={i}>
                        <td className="font-bold">{h.hsn}</td>
                        <td className="text-right">{h.taxable.toFixed(2)}</td>
                        <td className="text-right">{h.cgst.toFixed(2)}</td>
                        <td className="text-right">{h.sgst.toFixed(2)}</td>
                        <td className="text-right">{h.igst.toFixed(2)}</td>
                        <td className="text-right font-bold">{h.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Invoice View
  let srNo = 1;

  return (
    <div className="app-container">
      <div className="no-print header-actions flex justify-between">
        <div className="flex gap-2">
          <button onClick={newBill} className="btn">
            <FileText size={18} /> New Bill
          </button>
          <button onClick={() => setCurrentView('history')} className="btn">
            <History size={18} /> History
          </button>
          <button onClick={() => setCurrentView('gst-report')} className="btn">
            <BarChart3 size={18} /> GST Report
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={saveToHistory} className="btn">
            <Save size={18} /> Save Invoice
          </button>
          <button onClick={printDocument} className="btn primary">
            <Printer size={18} /> Print / Save PDF
          </button>
          <button onClick={() => setCurrentView('settings')} className="btn">
            <Settings size={18} /> Settings
          </button>
        </div>
      </div>

      <div className="invoice-paper" style={{ '--top-margin': `${config.topMargin}cm`, marginTop: `${config.topMargin}cm` }}>
        {/* Document Type Toggle (no-print) + Printed label */}
        <div className="no-print" style={{display: 'flex', justifyContent: 'center', marginBottom: 8}}>
          <div className="doc-type-toggle">
            <button
              className={invoiceData.documentType !== 'credit-note' ? 'active-invoice' : ''}
              onClick={() => handleInvoiceChange('documentType', 'invoice')}
            >
              Tax Invoice
            </button>
            <button
              className={invoiceData.documentType === 'credit-note' ? 'active-credit-note' : ''}
              onClick={() => handleInvoiceChange('documentType', 'credit-note')}
            >
              Credit Note
            </button>
          </div>
        </div>
        <div className="doc-type-label">
          <div className="doc-type-meta">Pan No. :- {config.companyPan || ''}</div>
          <div className="doc-type-title">{invoiceData.documentType === 'credit-note' ? 'CREDIT NOTE' : 'TAX INVOICE'}</div>
          <div className="doc-type-meta">GSTN :- {config.companyGst || ''}</div>
        </div>

        {/* Bill To & Invoice Meta */}
        <div className="invoice-meta-row">
          <div className="bill-to">
            <div className="grid-row">
              <label>Name</label><span>:</span>
              <input className="input-field font-bold" value={invoiceData.billToName} onChange={e => handleInvoiceChange('billToName', e.target.value)} />
            </div>
            <div className="grid-row">
              <label>Address</label><span>:</span>
              <textarea className="input-field" value={invoiceData.billToAddress} onChange={e => handleInvoiceChange('billToAddress', e.target.value)} />
            </div>
            <div className="grid-row">
              <label>Pin Code</label><span>:</span>
              <input className="input-field" value={invoiceData.billToPin} onChange={e => handleInvoiceChange('billToPin', e.target.value)} />
            </div>
            <div className="grid-row">
              <label>GSTIN</label><span>:</span>
              <input className="input-field font-bold" value={invoiceData.billToGst} onChange={e => handleInvoiceChange('billToGst', e.target.value)} />
            </div>
            <div className="grid-row">
              <label>State</label><span>:</span>
              <div className="flex-row w-full">
                <input className="input-field flex-grow" value={invoiceData.billToState} onChange={e => handleInvoiceChange('billToState', e.target.value)} />
                <span className="state-code-label">State Code :</span>
                <input className="input-field w-16 text-center" value={invoiceData.billToStateCode} onChange={e => handleInvoiceChange('billToStateCode', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="invoice-details">
            <div className="grid-row">
              <label>{invoiceData.documentType === 'credit-note' ? 'Credit Note No.' : 'Invoice No.'}</label><span>:</span>
              <input className="input-field" value={invoiceData.invoiceNo} onChange={e => handleInvoiceChange('invoiceNo', e.target.value)} />
            </div>
            {invoiceData.documentType === 'credit-note' && (
              <div className="grid-row">
                <label>Ref. Inv. No.</label><span>:</span>
                <input className="input-field" value={invoiceData.referenceInvoiceNo} onChange={e => handleInvoiceChange('referenceInvoiceNo', e.target.value)} placeholder="Original Invoice No." />
              </div>
            )}
            <div className="grid-row">
              <label>Date</label><span>:</span>
              <input className="input-field" value={invoiceData.invoiceDate} onChange={e => handleInvoiceChange('invoiceDate', e.target.value)} />
            </div>
            <div className="grid-row">
              <label>Order No.</label><span>:</span>
              <input className="input-field" value={invoiceData.orderNo} onChange={e => handleInvoiceChange('orderNo', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Invoice Table */}
        <table className="invoice-table">
          <thead>
            <tr>
              <th style={{width: '5%'}}>Sr.No.</th>
              <th style={{width: '45%'}}>Name of Product / Service</th>
              <th style={{width: '8%'}}>HSN SAC</th>
              <th style={{width: '8%'}}>Size</th>
              <th style={{width: '8%'}}>TTL.Sq.Ft.</th>
              <th style={{width: '6%'}}>Qty</th>
              <th style={{width: '8%'}}>Rate</th>
              <th style={{width: '12%'}}>Total</th>
              <th className="no-print" style={{width: '5%'}}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              if (item.type === 'title') {
                return (
                  <tr key={item.id} className="title-row">
                    <td></td>
                    <td>
                      <ExpandingTextarea 
                        className="input-field w-full font-bold underline" 
                        style={{textDecoration: 'underline', resize: 'none', overflow: 'hidden'}}
                        value={item.name} 
                        onChange={e => handleItemChange(item.id, 'name', e.target.value)} 
                        placeholder="Enter Title..."
                      />
                    </td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="no-print text-center">
                      <button onClick={() => removeItem(item.id)} className="icon-btn text-red"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              }
              
              return (
                <tr key={item.id} className="item-row">
                  <td className="text-center">{srNo++}</td>
                  <td>
                    <AutocompleteTextarea 
                      className="input-field w-full" 
                      value={item.name} 
                      onChange={e => handleItemChange(item.id, 'name', e.target.value)} 
                      onSelect={val => handleItemChange(item.id, 'name', val)}
                      options={config.productHsnMapping.filter(m => m.product)}
                    />
                  </td>
                  <td><input className="input-field w-full text-center" value={item.hsn} onChange={e => handleItemChange(item.id, 'hsn', e.target.value)} /></td>
                  <td><input className="input-field w-full text-center" value={item.size} onChange={e => handleItemChange(item.id, 'size', e.target.value)} /></td>
                  <td><input type="number" className="input-field w-full text-right" value={item.sqft} onChange={e => handleItemChange(item.id, 'sqft', parseFloat(e.target.value) || 0)} /></td>
                  <td><input type="number" className="input-field w-full text-right" value={item.qty} onChange={e => handleItemChange(item.id, 'qty', parseInt(e.target.value) || 0)} /></td>
                  <td><input type="number" className="input-field w-full text-right" value={item.rate} onChange={e => handleItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)} /></td>
                  <td className="text-right">{calculateItemTotal(item).toFixed(2)}</td>
                  <td className="no-print text-center">
                    <button onClick={() => removeItem(item.id)} className="icon-btn text-red"><Trash2 size={16} /></button>
                  </td>
                </tr>
              );
            })}
            
            <tr className="no-print">
              <td></td>
              <td className="text-center p-2">
                <div className="flex justify-center gap-4">
                  <button onClick={addItem} className="btn"><Plus size={16} /> Add Item Row</button>
                  <button onClick={addTitle} className="btn"><Plus size={16} /> Add Title Row</button>
                </div>
              </td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td className="no-print"></td>
            </tr>

            {/* Transportation Rows */}
            {transportation.map((t) => (
              <tr key={t.id} className="transportation-row">
                <td></td>
                <td>
                  <ExpandingTextarea className="input-field w-full" value={t.description} onChange={e => handleTransportChange(t.id, 'description', e.target.value)} placeholder="Transportation Charges..." />
                </td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td className="text-right relative">
                  <input type="number" className="input-field w-full text-right no-print" value={t.amount} onChange={e => handleTransportChange(t.id, 'amount', parseFloat(e.target.value) || 0)} />
                  <span className="print-only text-right block">{(Number(t.amount) || 0).toFixed(2)}</span>
                </td>
                <td className="no-print text-center">
                   <button onClick={() => removeTransport(t.id)} className="icon-btn text-red"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            
            <tr className="no-print">
              <td></td>
              <td className="text-center p-2">
                <button onClick={addTransport} className="btn text-xs"><Plus size={14} /> Add Transport Charge</button>
              </td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td className="no-print"></td>
            </tr>

            <tr className="empty-filler">
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td className="no-print"></td>
            </tr>
          </tbody>
        </table>

        {/* Footer Area */}
        <div className="invoice-footer border-t">
          <div className="footer-left">
            <div className="bank-details text-xxs">
              <div className="bank-row">
                <input className="input-field w-full font-bold py-0 text-xxs" value={config.bankInfo.bank1Name} onChange={e => handleConfigChange('bankInfo', 'bank1Name', e.target.value)} />
              </div>
              <div className="bank-row">
                <input className="input-field w-full py-0 text-xxs" value={config.bankInfo.bank1Branch} onChange={e => handleConfigChange('bankInfo', 'bank1Branch', e.target.value)} />
              </div>
              <div className="bank-row">
                <input className="input-field w-full font-bold py-0 text-xxs" value={config.bankInfo.bank2Name} onChange={e => handleConfigChange('bankInfo', 'bank2Name', e.target.value)} />
              </div>
              <div className="bank-row">
                <input className="input-field w-full py-0 text-xxs" value={config.bankInfo.bank2Branch} onChange={e => handleConfigChange('bankInfo', 'bank2Branch', e.target.value)} />
              </div>
            </div>
            <div className="amount-in-words font-bold mb-1 mt-1 text-xxs">
              Rs. {numberToWords(roundedTotal)}
            </div>
            <div className="terms-conditions text-xxs text-gray-600">
              <input className="input-field w-full py-0 text-xxs" value={config.termsInfo.term1} onChange={e => handleConfigChange('termsInfo', 'term1', e.target.value)} />
              <input className="input-field w-full py-0 text-xxs" value={config.termsInfo.term2} onChange={e => handleConfigChange('termsInfo', 'term2', e.target.value)} />
              <input className="input-field w-full py-0 text-xxs" value={config.termsInfo.term3} onChange={e => handleConfigChange('termsInfo', 'term3', e.target.value)} />
              <input className="input-field w-full py-0 text-xxs" value={config.termsInfo.term4} onChange={e => handleConfigChange('termsInfo', 'term4', e.target.value)} />
            </div>
            <div className="jurisdiction text-xxs mt-2">
              <p>E. & O.E.</p>
              <p>Subject to Jabalpur Jurisdiction</p>
            </div>
          </div>
          
          <div className="footer-right border-l pl-4 text-xxs">
            <div className="tax-calc-row">
              <span>Total</span>
              <span className="text-right">{taxableValue.toFixed(2)}</span>
            </div>
            <div className="tax-calc-row font-bold">
              <span>Total Amount/Taxable Value :</span>
              <span className="text-right">{taxableValue.toFixed(2)}</span>
            </div>
            {isInterState ? (
              <div className="tax-calc-row">
                <span className="flex items-center">Add : IGST :<input type="number" className="input-field w-12 text-right ml-1 py-0" value={igstRate} readOnly />{' '}%</span>
                <span className="text-right">{igst.toFixed(2)}</span>
              </div>
            ) : (
              <>
                <div className="tax-calc-row">
                  <span className="flex items-center">Add : CGST :<input type="number" className="input-field w-12 text-right ml-1 py-0" value={config.taxInfo.cgstRate} onChange={e => handleConfigChange('taxInfo', 'cgstRate', parseFloat(e.target.value) || 0)} />%</span>
                  <span className="text-right">{cgst.toFixed(2)}</span>
                </div>
                <div className="tax-calc-row">
                  <span className="flex items-center">Add : SGST :<input type="number" className="input-field w-12 text-right ml-1 py-0" value={config.taxInfo.sgstRate} onChange={e => handleConfigChange('taxInfo', 'sgstRate', parseFloat(e.target.value) || 0)} />%</span>
                  <span className="text-right">{sgst.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="tax-calc-row">
              <span className="flex items-center">
                Round Off
                <input 
                  type="checkbox" 
                  title="Enable Round Off"
                  className="no-print ml-2" 
                  checked={config.enableRoundOff !== false} 
                  onChange={e => handleConfigChange(null, 'enableRoundOff', e.target.checked)} 
                />
              </span>
              <span className="text-right">{roundOff.toFixed(2)}</span>
            </div>
            <div className="tax-calc-row font-bold">
              <span>Total Amount After Tax :</span>
              <span className="text-right">{roundedTotal.toFixed(2)}</span>
            </div>
            <div className="signature-area text-right mt-2">
              <p className="mb-2 text-xxs">for : Jain Advertising Agency</p>
              <p className="text-xxs">Proprietor.</p>
            </div>
          </div>
        </div>
      </div>
      {toastMessage && (
        <div className="toast-notification">{toastMessage}</div>
      )}
    </div>
  );
}

export default App;
