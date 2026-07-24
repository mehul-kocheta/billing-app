import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Printer, Settings, ArrowLeft, Save, FileText, History, Search } from 'lucide-react';
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
  ]
};

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
  const [currentView, setCurrentView] = useState('invoice'); // 'invoice' | 'settings' | 'history'
  const [searchQuery, setSearchQuery] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Invoice Data
  const [invoiceData, setInvoiceData] = useState({
    billToName: 'Ramani Ice-Cream & Co. Ltd.',
    billToAddress: 'Bhateja Parisar, Behind BPCL Petrol Pump\nMaharajpur, Jabalpur (M.P.)',
    billToPin: '482004',
    billToGst: '23AABCR4589H1Z8',
    billToState: 'Madhya Pradesh',
    billToStateCode: '23',
    invoiceNo: '007 / 2026 - 2027',
    invoiceDate: '07.04.2026',
    orderNo: '',
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
      if (window.electronAPI) {
        const savedConfig = await window.electronAPI.readConfig();
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
        const savedHistory = await window.electronAPI.readHistory();
        if (savedHistory && Array.isArray(savedHistory)) {
          setHistoryData(savedHistory);
        }
      }
      setLoaded(true);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (loaded && window.electronAPI) {
      window.electronAPI.writeConfig(config);
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

  const newBill = () => {
    setInvoiceData({
      billToName: '',
      billToAddress: '',
      billToPin: '',
      billToGst: '',
      billToState: '',
      billToStateCode: '',
      invoiceNo: '',
      invoiceDate: new Date().toLocaleDateString('en-GB').replace(/\//g, '.'),
      orderNo: '',
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
  const cgst = taxableValue * (config.taxInfo.cgstRate / 100);
  const sgst = taxableValue * (config.taxInfo.sgstRate / 100);
  const totalAfterTax = taxableValue + cgst + sgst;
  const roundedTotal = Math.round(totalAfterTax);
  const roundOff = roundedTotal - totalAfterTax;

  const saveToHistory = async () => {
    const newBillRec = {
      id: uuidv4(),
      timestamp: Date.now(),
      totalAmount: roundedTotal,
      invoiceData,
      items,
      transportation
    };
    const newHistory = [newBillRec, ...historyData];
    setHistoryData(newHistory);
    if (window.electronAPI) {
      await window.electronAPI.writeHistory(newHistory);
    }
    alert('Invoice saved to history!');
  };

  const loadFromHistory = (rec) => {
    setInvoiceData(rec.invoiceData);
    setItems(rec.items);
    setTransportation(rec.transportation || []);
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
    const filtered = historyData.filter(h => {
       const search = searchQuery.toLowerCase();
       const d = h.invoiceData;
       return (d.billToName && d.billToName.toLowerCase().includes(search)) ||
              (d.billToAddress && d.billToAddress.toLowerCase().includes(search)) ||
              (d.invoiceDate && d.invoiceDate.includes(search)) ||
              (d.invoiceNo && d.invoiceNo.toLowerCase().includes(search));
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
                onChange={e => setSearchQuery(e.target.value)}
             />
          </div>
          <div className="history-list mt-4">
             {filtered.length === 0 ? <p className="mt-4">No invoices found.</p> : null}
             {filtered.map(rec => (
                <div key={rec.id} className="history-card border p-4 mb-4 rounded bg-white shadow-sm flex justify-between items-center">
                   <div>
                      <h3 className="font-bold">{rec.invoiceData.billToName || 'Unnamed Client'}</h3>
                      <p className="text-sm text-gray-600">{rec.invoiceData.billToAddress}</p>
                      <p className="text-sm mt-1">
                        <strong>Inv No:</strong> {rec.invoiceData.invoiceNo} | <strong>Date:</strong> {rec.invoiceData.invoiceDate}
                      </p>
                   </div>
                   <div className="text-right">
                      <p className="font-bold text-lg mb-2">Rs. {rec.totalAmount}</p>
                      <button onClick={() => loadFromHistory(rec)} className="btn primary">Load Invoice</button>
                   </div>
                </div>
             ))}
          </div>
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
        {/* Bill To & Invoice Meta */}
        <div className="invoice-meta-row border-t">
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
              <label>Invoice No.</label><span>:</span>
              <input className="input-field" value={invoiceData.invoiceNo} onChange={e => handleInvoiceChange('invoiceNo', e.target.value)} />
            </div>
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
            <div className="bank-details border-b pb-1 mb-1">
              <div className="bank-row">
                <input className="input-field w-full font-bold py-0" value={config.bankInfo.bank1Name} onChange={e => handleConfigChange('bankInfo', 'bank1Name', e.target.value)} />
              </div>
              <div className="bank-row">
                <input className="input-field w-full py-0" value={config.bankInfo.bank1Branch} onChange={e => handleConfigChange('bankInfo', 'bank1Branch', e.target.value)} />
              </div>
              <div className="bank-row border-t mt-1 pt-1">
                <input className="input-field w-full font-bold py-0" value={config.bankInfo.bank2Name} onChange={e => handleConfigChange('bankInfo', 'bank2Name', e.target.value)} />
              </div>
              <div className="bank-row">
                <input className="input-field w-full py-0" value={config.bankInfo.bank2Branch} onChange={e => handleConfigChange('bankInfo', 'bank2Branch', e.target.value)} />
              </div>
            </div>
            <div className="amount-in-words font-bold mb-1 mt-1">
              Rs. {numberToWords(roundedTotal)}
            </div>
            <div className="terms-conditions text-xs text-gray-600">
              <input className="input-field w-full py-0" value={config.termsInfo.term1} onChange={e => handleConfigChange('termsInfo', 'term1', e.target.value)} />
              <input className="input-field w-full py-0" value={config.termsInfo.term2} onChange={e => handleConfigChange('termsInfo', 'term2', e.target.value)} />
              <input className="input-field w-full py-0" value={config.termsInfo.term3} onChange={e => handleConfigChange('termsInfo', 'term3', e.target.value)} />
              <input className="input-field w-full py-0" value={config.termsInfo.term4} onChange={e => handleConfigChange('termsInfo', 'term4', e.target.value)} />
            </div>
            <div className="jurisdiction text-xs mt-2">
              <p>E. & O.E.</p>
              <p>Subject to Jabalpur Jurisdiction</p>
            </div>
          </div>
          
          <div className="footer-right border-l pl-4">
            <div className="tax-calc-row">
              <span>Total</span>
              <span className="text-right">{taxableValue.toFixed(2)}</span>
            </div>
            <div className="tax-calc-row font-bold border-t pt-1 mt-1">
              <span>Total Amount/Taxable Value :</span>
              <span className="text-right">{taxableValue.toFixed(2)}</span>
            </div>
            <div className="tax-calc-row">
              <span className="flex items-center">Add : CGST :<input type="number" className="input-field w-12 text-right ml-1 py-0" value={config.taxInfo.cgstRate} onChange={e => handleConfigChange('taxInfo', 'cgstRate', parseFloat(e.target.value) || 0)} />%</span>
              <span className="text-right">{cgst.toFixed(2)}</span>
            </div>
            <div className="tax-calc-row">
              <span className="flex items-center">Add : SGST :<input type="number" className="input-field w-12 text-right ml-1 py-0" value={config.taxInfo.sgstRate} onChange={e => handleConfigChange('taxInfo', 'sgstRate', parseFloat(e.target.value) || 0)} />%</span>
              <span className="text-right">{sgst.toFixed(2)}</span>
            </div>
            <div className="tax-calc-row">
              <span>Round Off</span>
              <span className="text-right">{roundOff.toFixed(2)}</span>
            </div>
            <div className="tax-calc-row font-bold text-lg border-t pt-1 mt-1">
              <span>Total Amount After Tax :</span>
              <span className="text-right">{roundedTotal.toFixed(2)}</span>
            </div>
            <div className="signature-area text-right mt-8">
              <p className="mb-8 text-sm">for : Jain Advertising Agency</p>
              <p className="text-sm">Proprietor.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
