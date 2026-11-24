/* ================================================================
   FRONTENAC MARINE GEAR HUB - CHANGELOG
   ================================================================
   VERSION: 3.0.1

   CHANGELOG:
   ----------------------------------------------------------------

  v3.0.1 - Critical Bug Fixes
  v3.0.0 - Production Readiness Overhaul
  v2.2.0 - Reliability & Data Integrity
   v2.1.0 - Inventory Creation Enhancements
   v2.0.0 - Architecture Rewrite
   v1.3.0 - OAuth Integration
   v1.2.2 - Live Read Mode
   v1.2.1 - Mock Data Cleanup
   v1.2.0 - Survey Parser & Persistence
   v1.1.0 - Inventory System
   v1.0.0 - Initial Release
   ================================================================ */

   
   import IdentityManager from "https://js.arcgis.com/5.1/@arcgis/core/identity/IdentityManager.js";
   import OAuthInfo from "https://js.arcgis.com/5.1/@arcgis/core/identity/OAuthInfo.js";
   
   const itemDictionary = [
       'workPant', 'ventPant', 'shorts', 'hiVisSS', 'hiVisLS',
       'meshSS', 'hoodie', 'zipJkt', 'rainJkt', 'rainPnt',
       'winJkt', 'winPnt', 'tilley', 'cap', 'toque'
   ];
   
   const OAUTH_CONFIG = {
       clientId: "buEMr51pRqLi8SZB",  // PASTE YOUR CLIENT ID
       portalUrl: "https://www.arcgis.com"
   };
   
   let appInitialized = false;
   let isFirstLoad = true;
   
   // ================================================================
   // AGOL CLIENT - Data access layer
   // ================================================================
   const AGOLClient = {
       config: {
           surveyUrl: 'https://services2.arcgis.com/vJlmDE1PmdTcJF0N/arcgis/rest/services/service_a25ddf070d9b49a692eb5ba65e27f33f/FeatureServer/0',
           gearLogUrl: 'https://services2.arcgis.com/vJlmDE1PmdTcJF0N/arcgis/rest/services/gearLog/FeatureServer/0',
           inventoryUrl: 'https://services2.arcgis.com/vJlmDE1PmdTcJF0N/arcgis/rest/services/UniformInventory/FeatureServer/0'
       },
      
       async getToken() {
           try {
               const credential = await IdentityManager.checkSignInStatus(oauthInfo.portalUrl + "/sharing");
               return credential.token;
           } catch (e) {
               console.error("Token retrieval failed:", e);
               return null;
           }
       },
   
       async _request(url, options = {}) {
           try {
               const token = await this.getToken();
               if (!token) {
                   return { success: false, error: 'Session expired', code: 499, data: null };
               }
               
               // For all requests, use POST with token in body
               if (!options.method) {
                   options.method = 'POST';
                   options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
                   // Convert query params to body
                   const urlObj = new URL(url);
                   const params = new URLSearchParams(urlObj.search);
                   params.append('token', token);
                   options.body = params.toString();
                   url = urlObj.origin + urlObj.pathname;
               } else {
                   const separator = options.body.includes('token=') ? '&' : '&';
                   options.body += `${separator}token=${token}`;
               }
               
               const res = await fetch(url, options);
               
               if (!res.ok) {
                   if (res.status === 401 || res.status === 403 || res.status === 498 || res.status === 499) {
                       return { success: false, error: 'Session expired', code: res.status, data: null };
                   }
                   return { success: false, error: `Server error (${res.status})`, code: res.status, data: null };
               }
               
               const data = await res.json();
               if (data.error) {
                   const code = data.error.code;
                   const msg = data.error.message || 'AGOL request failed';
                   if (code === 498 || code === 499) {
                       return { success: false, error: 'Session expired', code, data: null };
                   }
                   return { success: false, error: msg, code, data: null };
               }
               return { success: true, error: null, code: 200, data };
           } catch (err) {
               console.error('Request failed:', err);
               return { success: false, error: 'Network error', code: 0, data: null };
           }
       },
   
       async querySurvey() {
           // Fetch all surveys with pagination
           const allFeatures = [];
           let offset = 0;
           const pageSize = 1000;
           let hasMore = true;
           
           while (hasMore) {
               const url = `${this.config.surveyUrl}/query?where=1=1&outFields=*&orderByFields=reqDate DESC&resultOffset=${offset}&resultRecordCount=${pageSize}&f=json`;
               const result = await this._request(url);
               if (!result.success) return result;
               
               if (!result.data.features || result.data.features.length === 0) {
                   hasMore = false;
               } else {
                   allFeatures.push(...result.data.features.map(f => f.attributes));
                   offset += pageSize;
                   
                   // Check if we got less than requested (last page)
                   if (result.data.features.length < pageSize) {
                       hasMore = false;
                   }
                   
                   // Check exceededTransferLimit
                   if (result.data.exceededTransferLimit) {
                       hasMore = true;
                   } else {
                       hasMore = false;
                   }
               }
           }
           
           return { success: true, error: null, data: allFeatures };
       },
   
       async queryGearLog() {
           const allFeatures = [];
           let offset = 0;
           const pageSize = 1000;
           let hasMore = true;
           
           while (hasMore) {
               const url = `${this.config.gearLogUrl}/query?where=1=1&outFields=*&resultOffset=${offset}&resultRecordCount=${pageSize}&f=json`;
               const result = await this._request(url);
               if (!result.success) return result;
               
               if (!result.data.features || result.data.features.length === 0) {
                   hasMore = false;
               } else {
                   allFeatures.push(...result.data.features.map(f => f.attributes));
                   offset += pageSize;
                   
                   if (result.data.features.length < pageSize) {
                       hasMore = false;
                   }
                   
                   if (result.data.exceededTransferLimit) {
                       hasMore = true;
                   } else {
                       hasMore = false;
                   }
               }
           }
           
           return { success: true, error: null, data: allFeatures };
       },
   
       async queryInventory() {
           const allFeatures = [];
           let offset = 0;
           const pageSize = 1000;
           let hasMore = true;
           
           while (hasMore) {
               const url = `${this.config.inventoryUrl}/query?where=1=1&outFields=*&resultOffset=${offset}&resultRecordCount=${pageSize}&f=json`;
               const result = await this._request(url);
               if (!result.success) return result;
               
               if (!result.data.features || result.data.features.length === 0) {
                   hasMore = false;
               } else {
                   allFeatures.push(...result.data.features.map(f => f.attributes));
                   offset += pageSize;
                   
                   if (result.data.features.length < pageSize) {
                       hasMore = false;
                   }
                   
                   if (result.data.exceededTransferLimit) {
                       hasMore = true;
                   } else {
                       hasMore = false;
                   }
               }
           }
           
           return { 
               success: true, 
               error: null, 
               data: allFeatures.filter(i => i.Active !== false && i.Active !== 'false' && i.Active !== 0)
           };
       },
   
       async createGearLog(record) {
           const url = `${this.config.gearLogUrl}/applyEdits`;
           const adds = [{
               attributes: {
                   surveyId: record.surveyId,
                   staffName: record.staffName,
                   gearState: record.gearState,
                   orderStatus: record.orderStatus,
                   lastUpdated: Date.now(),
                   updatedBy: record.updatedBy || ''
               }
           }];
           const body = 'adds=' + encodeURIComponent(JSON.stringify(adds)) + '&f=json';
           const result = await this._request(url, {
               method: 'POST',
               headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
               body
           });
   
           if (!result.success) {
               console.error('GearLog create failed:', result.error);
               return null;
           }
   
           if (result.data.addResults && result.data.addResults[0]) {
               if (result.data.addResults[0].success) {
                   return result.data.addResults[0].objectId;
               } else {
                   console.error('GearLog create failed:', result.data.addResults[0].error);
                   return null;
               }
           }
           return null;
       },
   
       async updateGearLog(objectId, record) {
           const url = `${this.config.gearLogUrl}/applyEdits`;
           const updates = [{
               attributes: {
                   OBJECTID: objectId,
                   gearState: record.gearState,
                   orderStatus: record.orderStatus,
                   lastUpdated: Date.now(),
                   updatedBy: record.updatedBy || ''
               }
           }];
           const body = 'updates=' + encodeURIComponent(JSON.stringify(updates)) + '&f=json';
           const result = await this._request(url, {
               method: 'POST',
               headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
               body
           });
   
           if (!result.success) {
               console.error('GearLog update failed:', result.error);
               return false;
           }
   
           if (result.data.updateResults && result.data.updateResults[0]) {
               if (!result.data.updateResults[0].success) {
                   console.error('GearLog update failed:', result.data.updateResults[0].error);
                   return false;
               }
               return true;
           }
           return false;
       },
   
       async updateInventory(objectId, fields) {
           const url = `${this.config.inventoryUrl}/applyEdits`;
           const updates = [{ attributes: { OBJECTID: objectId, ...fields } }];
           const body = 'updates=' + encodeURIComponent(JSON.stringify(updates)) + '&f=json';
           const result = await this._request(url, {
               method: 'POST',
               headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
               body
           });
   
           if (!result.success) {
               console.error('Inventory update failed:', result.error);
               return false;
           }
   
           if (result.data.updateResults && result.data.updateResults[0]) {
               if (!result.data.updateResults[0].success) {
                   console.error('Inventory update failed:', result.data.updateResults[0].error);
                   return false;
               }
               return true;
           }
           return false;
       },
   
       async createInventoryItem(item) {
           const url = `${this.config.inventoryUrl}/applyEdits`;
           const adds = [{
               attributes: {
                   ItemName: item.ItemName,
                   Style: item.Style || 'Standard',
                   Size1: item.Size1 || '',
                   Size2: item.Size2 || 'N/A',
                   Category: item.Category || 'General',
                   Bin: item.Bin,
                   Stock: item.Stock || 0,
                   Reorder: item.Reorder || 5,
                   Active: true,
                   LastAct: `Created via Hub by ${item.CreatedBy || 'System'}`
               }
           }];
           const body = 'adds=' + encodeURIComponent(JSON.stringify(adds)) + '&f=json';
           const result = await this._request(url, {
               method: 'POST',
               headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
               body
           });
   
           if (!result.success) {
               console.error('Inventory create failed:', result.error);
               return null;
           }
   
           if (result.data.addResults && result.data.addResults[0] && result.data.addResults[0].success) {
               return result.data.addResults[0].objectId;
           } else {
               console.error('Inventory create failed:', result.data.addResults?.[0]?.error);
               return null;
           }
       }
   };
   
   // ================================================================
   // STATE
   // ================================================================
   let inventoryData = [];
   let inventoryIndex = new Map(); // String(OBJECTID) -> inventory item
   let binsByItem = new Map(); // Bin ID -> [items]
   let requestList = [];
   let gearLogMap = new Map();
   let expandedRequests = new Set();
   let actionLog = [];
   let currentContext = null;
   let shelfSearchQuery = '';
   let shelfSearchTimeout;
   let currentShelf = 'shelfA';
   const binMap = {};
   const inFlightAdjustments = new Set();
   
   // ================================================================
   // SHELF LAYOUT
   // ================================================================
   const shelfLayout = {
       shelfA: {
           title: "Shelf A",
           rows: [
               { label: "Top", bins: [{ id: "A-T1", label: "Tilley Hats", icon: "ph-cowboy-hat" }] },
               { label: "Mid 1", bins: [
                   { id: "A-M1a", label: "Hoodies S / M", icon: "ph-hoodie" },
                   { id: "A-M1b", label: "Hoodies L", icon: "ph-hoodie" },
                   { id: "A-M1c", label: "Hoodies XL", icon: "ph-hoodie" }
               ]},
               { label: "Mid 2", bins: [
                   { id: "A-M2a", label: "Coolworks (<=34)", icon: "ph-pants" },
                   { id: "A-M2b", label: "Coolworks (>=36)", icon: "ph-pants" },
                   { id: "A-M2c", label: "Winter Coats", icon: "ph-coat-hanger" }
               ]},
               { label: "Low", bins: [
                   { id: "A-L1", label: "Work Pants 26-38", icon: "ph-pants" },
                   { id: "A-L2", label: "Work Pants 40-42", icon: "ph-pants" },
                   { id: "A-L3", label: "Work Pants 44+", icon: "ph-pants" }
               ]}
           ]
       },
       shelfB: {
           title: "Shelf B",
           rows: [
               { label: "Top", bins: [
                   { id: "B-T1", label: "Shorts", icon: "ph-pants" },
                   { id: "B-T2", label: "Blue Shirts", icon: "ph-t-shirt" },
                   { id: "B-T3", label: "Traffic Vests", icon: "ph-warning" },
                   { id: "B-T4", label: "Tumblers", icon: "ph-coffee" }
               ]},
               { label: "Mid 1", bins: [
                   { id: "B-M1a", label: "Hoodies 2XL", icon: "ph-hoodie" },
                   { id: "B-M1b", label: "Hoodies 3XL", icon: "ph-hoodie" },
                   { id: "B-M1c", label: "Hoodies 4XL+", icon: "ph-hoodie" }
               ]},
               { label: "Mid 2", bins: [
                   { id: "B-M2a", label: "Zip Hoodies S-L", icon: "ph-hoodie" },
                   { id: "B-M2b", label: "Zip Hoodies XL", icon: "ph-hoodie" },
                   { id: "B-M2c", label: "Zip Hoodies 2XL+", icon: "ph-hoodie" }
               ]},
               { label: "Low", bins: [
                   { id: "B-L1", label: "Winter Coats", icon: "ph-coat-hanger" },
                   { id: "B-L2", label: "Winter Bibs", icon: "ph-pants" },
                   { id: "B-L3", label: "Rain Bibs", icon: "ph-pants" }
               ]}
           ]
       },
       shelfC: {
           title: "Shelf C",
           rows: [
               { label: "Top", bins: [
                   { id: "C-T1", label: "Coveralls", icon: "ph-coat-hanger" },
                   { id: "C-T2", label: "Rain Suits", icon: "ph-cloud-rain" },
                   { id: "C-T3", label: "Traffic LS 3XL+", icon: "ph-t-shirt" },
                   { id: "C-T4", label: "Traffic SS 5XL", icon: "ph-t-shirt" }
               ]},
               { label: "Mid 1", bins: [
                   { id: "C-M1a", label: "Traffic LS S-M", icon: "ph-t-shirt" },
                   { id: "C-M1b", label: "Traffic LS L", icon: "ph-t-shirt" },
                   { id: "C-M1c", label: "Traffic LS XL", icon: "ph-t-shirt" },
                   { id: "C-M1d", label: "Traffic LS 2XL", icon: "ph-t-shirt" }
               ]},
               { label: "Mid 2", bins: [
                   { id: "C-M2a", label: "Traffic SS S-M", icon: "ph-t-shirt" },
                   { id: "C-M2b", label: "Traffic SS L-XL", icon: "ph-t-shirt" },
                   { id: "C-M2c", label: "Traffic SS 2XL", icon: "ph-t-shirt" },
                   { id: "C-M2d", label: "Traffic SS 3-4XL", icon: "ph-t-shirt" }
               ]},
               { label: "Low", bins: [
                   { id: "C-L1", label: "Miscellaneous", icon: "ph-package" },
                   { id: "C-G2", label: "Returns Box", icon: "ph-arrow-counter-clockwise" }
               ]}
           ]
       },
       cupboards: {
           title: "Cupboards",
           rows: [
               { label: "Storage", bins: [
                   { id: "CB1", label: "Hats & Glasses", icon: "ph-hard-hat" },
                   { id: "CB2", label: "Gloves", icon: "ph-hand" }
               ]}
           ]
       }
   };
   
   Object.keys(shelfLayout).forEach(sk => {
       shelfLayout[sk].rows.forEach(row => {
           row.bins.forEach(bin => { binMap[bin.id] = { ...bin, shelfKey: sk }; });
       });
   });
   
   // ================================================================
   // HELPERS
   // ================================================================
   function escapeHtml(str) {
       if (str == null) return '';
       const div = document.createElement('div');
       div.textContent = String(str);
       return div.innerHTML;
   }
   
   function encodeFulfillLog(obj) {
       const compact = {};
       Object.entries(obj).forEach(([key, value]) => {
           const idx = itemDictionary.indexOf(key);
           if (idx !== -1 && value > 0) compact[idx] = value;
       });
       return JSON.stringify(compact);
   }
   
   function decodeFulfillLog(str) {
       if (!str) return {};
       try {
           const compact = JSON.parse(str);
           const expanded = {};
           Object.entries(compact).forEach(([idx, value]) => {
               const key = itemDictionary[parseInt(idx)];
               if (key) expanded[key] = value;
           });
           return expanded;
       } catch (e) {
           console.warn('Failed to parse gearState JSON:', e);
           return {};
       }
   }
   
   function computeStatus(items, log) {
       if (items.length === 0) return 'Empty';
       let any = false, all = true;
       items.forEach(item => {
           const done = log[item.itemKey] || 0;
           if (done > 0) any = true;
           if (done < item.qtyRequested) all = false;
       });
       return all ? 'Complete' : (any ? 'Partial' : 'New');
   }
   
   function buildFulfillLog(req) {
       const log = {};
       req.items.forEach(item => {
           if (item.qtyFulfilled > 0) log[item.itemKey] = item.qtyFulfilled;
       });
       return log;
   }
   
   function rebuildInventoryIndex() {
       inventoryIndex.clear();
       binsByItem.clear();
       
       inventoryData.forEach(item => {
           inventoryIndex.set(String(item.OBJECTID), item);
           if (item.Bin) {
               if (!binsByItem.has(item.Bin)) {
                   binsByItem.set(item.Bin, []);
               }
               binsByItem.get(item.Bin).push(item);
           }
       });
   }
   
   function getItemsForBin(binId) {
       return binsByItem.get(binId) || [];
   }
   
   function parseSurveyRecord(attr) {
       const items = [];
       const addItem = (itemKey, qty, name, style, size1, size2) => {
           qty = parseInt(qty) || 0;
           if (qty > 0) {
               items.push({
                   itemKey, ItemName: name, Style: style,
                   Size1: String(size1 || ''), Size2: String(size2 || 'N/A'),
                   qtyRequested: qty, qtyFulfilled: 0, isComplete: false
               });
           }
       };
   
       addItem('workPant', attr.workPantQty, 'Regular Work Pants', attr.workPantStyle, attr.workPantW, attr.workPantL);
       addItem('ventPant', attr.ventPantQty, 'Coolworks Pants', 'Standard', attr.ventPantW, attr.ventPantL);
       addItem('shorts', attr.shortsQty, 'Shorts', 'Standard', attr.shortsW, 'N/A');
       addItem('hiVisSS', attr.hiVisSSQty, 'Hi-Vis T-Shirt', 'Solid', attr.hiVisSSSize, 'N/A');
       addItem('hiVisLS', attr.hiVisLSQty, 'Hi-Vis Long Sleeve', 'Solid', attr.hiVisLSSize, 'N/A');
       addItem('meshSS', attr.meshSSQty, 'Hi-Vis T-Shirt', 'Mesh', attr.meshSSSize, 'N/A');
       addItem('hoodie', attr.hoodieQty, 'Hoodie', 'Pullover', attr.hoodieSize, 'N/A');
       addItem('zipJkt', attr.zipQty, 'Hoodie', 'Zippered', attr.zipSize, 'N/A');
       addItem('rainJkt', attr.rainJktQty, 'Coastal Rain Jacket', 'Standard', attr.rainJktSize, 'N/A');
       addItem('rainPnt', attr.rainPntQty, 'Coastal Rain Bibs', 'Standard', attr.rainPntSize, 'N/A');
       addItem('winJkt', attr.winJktQty, 'Winter Jacket', 'Standard', attr.winJktSize, 'N/A');
       addItem('winPnt', attr.winPntQty, 'Winter Bibs', 'Standard', attr.winPntSize, 'N/A');
       addItem('tilley', attr.tilleyQty, 'Tilley Hat', attr.tilleyColor, attr.tilleySize, 'N/A');
       addItem('cap', attr.capQty, 'Baseball Cap', 'Standard', 'O/S', 'N/A');
       addItem('toque', attr.toqueQty, 'Winter Toque', attr.toqueColor, 'O/S', 'N/A');
   
       const globalId = attr.globalid || attr.GlobalID || attr.GLOBALID || '';
       const gearRecord = gearLogMap.get(globalId);
       let log = {};
       let status = 'New';
   
       if (items.length === 0) {
           status = 'Empty';
       } else if (gearRecord) {
           if (gearRecord.orderStatus === 'Complete') {
               status = 'Complete';
               items.forEach(item => {
                   item.qtyFulfilled = item.qtyRequested;
                   item.isComplete = true;
               });
           } else {
               log = decodeFulfillLog(gearRecord.gearState);
               items.forEach(item => {
                   item.qtyFulfilled = log[item.itemKey] || 0;
                   item.isComplete = item.qtyFulfilled >= item.qtyRequested;
               });
               status = computeStatus(items, log);
           }
       }
   
       return {
           recordId: attr.OBJECTID || attr.objectid,
           requestId: `REQ-${attr.OBJECTID || attr.objectid}`,
           globalId: globalId,
           staffName: attr.staffName || '',
           staffEmail: attr.staffEmail || '',
           staffType: attr.staffType || 'Unknown',
           dateCreated: formatAgolDate(attr.reqDate),
           gearLogObjectId: gearRecord ? gearRecord.OBJECTID : null,
           status: status,
           items
       };
   }
   
   function formatAgolDate(val) {
       if (!val) return '';
       if (typeof val === 'number') {
           return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
       }
       return val;
   }
   
   function findInventoryItem(itemName, style, size1, size2) {
       const searchName = String(itemName || '').trim().toLowerCase();
       const searchStyle = String(style || '').trim().toLowerCase();
       const searchSize1 = String(size1 || '').trim().toLowerCase();
       const searchSize2 = String(size2 || '').trim().toLowerCase();
       
       return inventoryData.find(i => {
           const invName = String(i.ItemName || '').trim().toLowerCase();
           const invStyle = String(i.Style || '').trim().toLowerCase();
           const invSize1 = String(i.Size1 || '').trim().toLowerCase();
           const invSize2 = String(i.Size2 || '').trim().toLowerCase();
           
           // Partial matching for name (e.g., "Work Pants" matches "Regular Work Pants")
           const nameMatch = invName.includes(searchName) || searchName.includes(invName);
           const styleMatch = invStyle === searchStyle;
           const size1Match = invSize1 === searchSize1;
           
           // Symmetric Size2 matching
           const size2Match = (searchSize2 && searchSize2 !== 'n/a') 
               ? invSize2 === searchSize2 
               : (invSize2 === '' || invSize2 === 'n/a');
           
           return nameMatch && styleMatch && size1Match && size2Match;
       });
   }
   
   function getItemLocation(inv) {
       if (!inv || !inv.Bin) return '';
       const bin = binMap[inv.Bin];
       if (!bin) return inv.Bin;
       return `${inv.Bin} - ${shelfLayout[bin.shelfKey].title}`;
   }
   
   function formatSize(p, s) { return (s && s !== "N/A") ? `${p} / ${s}` : p; }
   
   function getStockBadgeClass(stock, reorder) {
       stock = stock ?? 0;
       reorder = reorder ?? 5;
       if (stock === 0) return 'stock-empty';
       if (stock <= reorder) return 'stock-low';
       return 'stock-good';
   }
   
   function getDotColor(stock, reorder) {
       stock = stock ?? 0;
       reorder = reorder ?? 5;
       if (stock === 0) return 'bg-rose-500';
       if (stock <= reorder) return 'bg-amber-500';
       return 'bg-emerald-500';
   }
   
   function getBinStockStatus(items) {
       if (items.length === 0) return { class: 'stock-empty', color: 'bg-rose-500', total: 0 };
       
       let total = 0;
       let hasLow = false;
       let hasEmpty = false;
       
       items.forEach(item => {
           const stock = item.Stock ?? 0;
           const reorder = item.Reorder ?? 5;
           total += stock;
           if (stock === 0) hasEmpty = true;
           if (stock <= reorder) hasLow = true;
       });
       
       if (hasEmpty) return { class: 'stock-empty', color: 'bg-rose-500', total };
       if (hasLow) return { class: 'stock-low', color: 'bg-amber-500', total };
       return { class: 'stock-good', color: 'bg-emerald-500', total };
   }
   
   function getStatusBadge(status) {
       if (status === 'Complete') return '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Complete</span>';
       if (status === 'Partial') return '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Partial</span>';
       if (status === 'Empty') return '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-700 border border-gray-200">Empty</span>';
       return '<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">New</span>';
   }
   
   function closeModal(id) {
       const modal = document.getElementById(id);
       if (!modal) return;
       
       const previousFocus = modal._previousFocus;
       modal.classList.add('hidden');
       modal.classList.remove('flex');
       
       if (previousFocus && previousFocus.focus && document.body.contains(previousFocus)) {
           previousFocus.focus();
       }
       
       currentContext = null;
   }
   
   function openModal(id) {
       const modal = document.getElementById(id);
       if (!modal) return;
       
       modal._previousFocus = document.activeElement;
       modal.classList.remove('hidden');
       modal.classList.add('flex');
       
       setTimeout(() => {
           const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
           if (focusable) focusable.focus();
       }, 100);
   }
   
   function updateUserDisplay(name) {
       document.getElementById("userDisplayName").innerText = name;
       document.getElementById("userAvatar").innerText = name.charAt(0).toUpperCase();
   }
   
   function getCurrentUserName() {
       return document.getElementById("userDisplayName").innerText;
   }
   
   function getUniqueValues(field) {
       const values = new Set();
       inventoryData.forEach(item => {
           const val = item[field];
           if (val && val !== '' && val !== 'N/A') {
               values.add(String(val));
           }
       });
       return Array.from(values).sort();
   }
   
   function populateDatalists() {
       const fields = {
           'addItemName': 'ItemName',
           'addStyle': 'Style',
           'addCategory': 'Category',
           'addSize1': 'Size1',
           'addSize2': 'Size2'
       };
       
       Object.entries(fields).forEach(([inputId, fieldName]) => {
           const datalist = document.getElementById(`${inputId}List`);
           if (datalist) {
               const values = getUniqueValues(fieldName);
               datalist.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">`).join('');
           }
       });
   }
   
   function copyFromExisting(objectId) {
       const item = inventoryIndex.get(String(objectId));
       if (!item) return;
       
       document.getElementById("addItemName").value = item.ItemName || '';
       document.getElementById("addStyle").value = item.Style || 'Standard';
       document.getElementById("addCategory").value = item.Category || 'General';
       document.getElementById("addSize1").value = item.Size1 || '';
       document.getElementById("addSize2").value = item.Size2 || 'N/A';
   }
   
   function switchTab(tabId) {
       document.querySelectorAll('.view-panel').forEach(p => p.classList.add('hidden'));
       document.getElementById(`panel-${tabId}`).classList.remove('hidden');
       document.querySelectorAll('.nav-tab').forEach(btn => {
           btn.classList.remove('bg-indigo-50', 'text-indigo-700', 'shadow-sm');
           btn.classList.add('text-slate-600', 'hover:text-slate-800', 'hover:bg-slate-50');
           btn.setAttribute('aria-selected', 'false');
       });
       const active = document.getElementById(`tab-${tabId}`);
       active.classList.add('bg-indigo-50', 'text-indigo-700', 'shadow-sm');
       active.classList.remove('text-slate-600', 'hover:text-slate-800', 'hover:bg-slate-50');
       active.setAttribute('aria-selected', 'true');
       if (tabId === 'audit') renderAuditTable();
       if (tabId === 'storage') renderShelf();
   }
   
   function toggleArchive() {
       const content = document.getElementById("archiveContent");
       const chevron = document.getElementById("archiveChevron");
       const button = content.previousElementSibling;
       content.classList.toggle('hidden');
       chevron.classList.toggle('rotate-180');
       button.setAttribute('aria-expanded', !content.classList.contains('hidden'));
   }
   
   // ================================================================
   // INITIALIZATION
   // ================================================================
   async function init() {
       loadAuditLog();
       try {
           const [inventoryResult, surveyResult, gearLogResult] = await Promise.all([
               AGOLClient.queryInventory(),
               AGOLClient.querySurvey(),
               AGOLClient.queryGearLog()
           ]);
   
           const failures = [];
           if (!inventoryResult.success) failures.push(`Inventory: ${inventoryResult.error}`);
           if (!surveyResult.success) failures.push(`Surveys: ${surveyResult.error}`);
           if (!gearLogResult.success) failures.push(`GearLog: ${gearLogResult.error}`);
   
           if (failures.length > 0) {
               showDataError(failures);
               return;
           }
   
           inventoryData = inventoryResult.data;
           rebuildInventoryIndex();
   
           gearLogMap = new Map();
           gearLogResult.data.forEach(record => {
               if (record.surveyId && !gearLogMap.has(record.surveyId)) {
                   gearLogMap.set(record.surveyId, record);
               }
           });
   
           requestList = surveyResult.data.map(parseSurveyRecord);
   
           console.log(`[Hub] Inventory: ${inventoryData.length} | Surveys: ${requestList.length} | GearLog: ${gearLogMap.size}`);
   
           if (isFirstLoad) {
               logTransaction("SystemInit", "System", 0, 0, 0, "System", `Loaded ${inventoryData.length} items, ${requestList.length} requests`);
               isFirstLoad = false;
           }
   
           renderAll();
       } catch (err) {
           console.error('Init failed:', err);
           showDataError(['Unexpected error during data load.']);
       }
   }
   
   function showDataError(errors) {
       const errorDiv = document.getElementById("dataErrorBanner");
       if (errorDiv) {
           errorDiv.innerHTML = `
               <div class="bg-rose-50 border-2 border-rose-200 rounded-2xl p-6 mb-6">
                   <div class="flex items-start gap-3">
                       <i class="ph ph-warning-circle text-2xl text-rose-500 shrink-0"></i>
                       <div class="flex-1">
                           <h3 class="text-base font-bold text-rose-800 mb-1">Data Load Failed</h3>
                           <ul class="text-sm text-rose-700 space-y-1 mb-3">
                               ${errors.map(e => `<li>• ${escapeHtml(e)}</li>`).join('')}
                           </ul>
                           <button onclick="retryLoad()" class="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700">
                               <i class="ph ph-arrow-clockwise"></i> Retry
                           </button>
                       </div>
                   </div>
               </div>`;
           errorDiv.classList.remove('hidden');
       } else {
           alert('Failed to load data: ' + errors.join(', '));
       }
   }
   
   function retryLoad() {
       const errorDiv = document.getElementById("dataErrorBanner");
       if (errorDiv) errorDiv.classList.add('hidden');
       init();
   }
   
   // ================================================================
   // REQUESTS UI
   // ================================================================
   function openInviteModal() {
       document.getElementById("inviteName").value = "";
       document.getElementById("inviteEmail").value = "";
       openModal('inviteModal');
   }
   
   function sendInvite() {
       const name = document.getElementById("inviteName").value.trim();
       const email = document.getElementById("inviteEmail").value.trim();
       if (!name || !email) return alert("Name and email required.");
       logTransaction("InviteSent", "Survey123 Invite", 0, 0, 0, getCurrentUserName(), `Sent to ${name} (${email})`);
       const subject = encodeURIComponent("Action Required: Uniform Request");
       const body = encodeURIComponent(`Hi ${name},\n\nPlease submit your requirements:\nhttps://survey123.arcgis.com/share/frontenac-uniforms`);
       window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
       closeModal('inviteModal');
       renderAuditTable();
   }
   
   function openFulfill(reqId, idx) {
       const req = requestList.find(r => r.requestId === reqId);
       if (!req) return;
       const li = req.items[idx];
       const inv = findInventoryItem(li.ItemName, li.Style, li.Size1, li.Size2);
       const stock = inv ? (inv.Stock ?? 0) : 0;
       const remaining = li.qtyRequested - li.qtyFulfilled;
       currentContext = { reqId, idx, remaining, stock };
       document.getElementById("fulfillItemDetails").innerText = `${li.ItemName} (${li.Style}) | ${formatSize(li.Size1, li.Size2)}`;
       document.getElementById("fulfillStock").innerText = stock;
       document.getElementById("fulfillQtyInput").value = Math.min(remaining, stock) || 1;
       document.getElementById("fulfillNotes").value = "";
       document.getElementById("fulfillError").classList.add("hidden");
       openModal('fulfillModal');
   }
   
   async function confirmFulfill() {
       const { reqId, idx, remaining, stock } = currentContext;
       const qty = parseInt(document.getElementById("fulfillQtyInput").value);
       const err = document.getElementById("fulfillError");
       const confirmBtn = document.querySelector('#fulfillModal button[onclick="confirmFulfill()"]');
   
       if (isNaN(qty) || qty <= 0) { err.querySelector('span').innerText = "Enter a valid quantity."; err.classList.remove('hidden'); return; }
       if (qty > remaining) { err.querySelector('span').innerText = `Only ${remaining} remaining to fulfill.`; err.classList.remove('hidden'); return; }
       if (qty > stock) { err.querySelector('span').innerText = `Only ${stock} in stock. Use Storage Room to add more.`; err.classList.remove('hidden'); return; }
   
       confirmBtn.disabled = true;
       confirmBtn.innerText = "Saving...";
   
       const req = requestList.find(r => r.requestId === reqId);
       const li = req.items[idx];
       const inv = findInventoryItem(li.ItemName, li.Style, li.Size1, li.Size2);
       const note = document.getElementById("fulfillNotes").value.trim();
       const userName = getCurrentUserName();
   
       try {
           let inventorySuccess = true;
           let gearLogSuccess = true;
   
           // STEP 1: Write inventory to server FIRST
           if (inv) {
               const newStock = (inv.Stock ?? 0) - qty;
               inventorySuccess = await AGOLClient.updateInventory(inv.OBJECTID, {
                   Stock: newStock,
                   LastAct: `Fulfilled ${qty}x to ${req.staffName}${note ? ' - ' + note : ''}`
               });
               
               if (!inventorySuccess) {
                   err.querySelector('span').innerText = "Stock update failed. Please try again.";
                   err.classList.remove('hidden');
                   confirmBtn.disabled = false;
                   confirmBtn.innerText = "Confirm";
                   return;
               }
               
               inv.Stock = newStock;
           }
   
           // STEP 2: Build updated fulfill log
           const tempFulfilled = li.qtyFulfilled + qty;
           const log = {};
           req.items.forEach(item => {
               if (item === li) {
                   if (tempFulfilled > 0) log[item.itemKey] = tempFulfilled;
               } else {
                   if (item.qtyFulfilled > 0) log[item.itemKey] = item.qtyFulfilled;
               }
           });
           const newStatus = computeStatus(req.items, { ...log });
           const gearStateJson = encodeFulfillLog(log);
   
           // STEP 3: Write gearLog to server
           if (req.gearLogObjectId) {
               gearLogSuccess = await AGOLClient.updateGearLog(req.gearLogObjectId, {
                   gearState: gearStateJson,
                   orderStatus: newStatus,
                   updatedBy: userName
               });
               
               if (gearLogSuccess) {
                   const existing = gearLogMap.get(req.globalId);
                   if (existing) {
                       existing.gearState = gearStateJson;
                       existing.orderStatus = newStatus;
                   }
               }
           } else {
               // Check for duplicate
               if (gearLogMap.has(req.globalId)) {
                   const existing = gearLogMap.get(req.globalId);
                   gearLogSuccess = await AGOLClient.updateGearLog(existing.OBJECTID, {
                       gearState: gearStateJson,
                       orderStatus: newStatus,
                       updatedBy: userName
                   });
                   if (gearLogSuccess) {
                       req.gearLogObjectId = existing.OBJECTID;
                       existing.gearState = gearStateJson;
                       existing.orderStatus = newStatus;
                   }
               } else {
                   const newObjectId = await AGOLClient.createGearLog({
                       surveyId: req.globalId,
                       staffName: req.staffName,
                       gearState: gearStateJson,
                       orderStatus: newStatus,
                       updatedBy: userName
                   });
                   
                   if (newObjectId) {
                       req.gearLogObjectId = newObjectId;
                       gearLogMap.set(req.globalId, { OBJECTID: newObjectId, surveyId: req.globalId, gearState: gearStateJson, orderStatus: newStatus });
                       gearLogSuccess = true;
                   } else {
                       gearLogSuccess = false;
                   }
               }
           }
   
           if (!gearLogSuccess) {
               // ROLLBACK: Reverse inventory write
               let rollbackSuccess = false;
               if (inv && inventorySuccess) {
                   const rollbackStock = inv.Stock + qty;
                   rollbackSuccess = await AGOLClient.updateInventory(inv.OBJECTID, {
                       Stock: rollbackStock,
                       LastAct: `Rollback: gearLog save failed`
                   });
                   if (rollbackSuccess) {
                       inv.Stock = rollbackStock;
                   }
               }
               
               if (rollbackSuccess) {
                   err.querySelector('span').innerText = "Fulfillment record failed to save. Stock was reverted.";
               } else {
                   err.querySelector('span').innerText = "Critical error: Fulfillment record failed and stock rollback also failed. Please contact support.";
               }
               err.classList.remove('hidden');
               confirmBtn.disabled = false;
               confirmBtn.innerText = "Confirm";
               return;
           }
   
           // STEP 4: All writes succeeded, NOW update local state
           li.qtyFulfilled += qty;
           li.isComplete = li.qtyFulfilled >= li.qtyRequested;
           req.status = newStatus;
   
           logTransaction("Fulfilled", `${li.ItemName} (${li.Style}) ${formatSize(li.Size1, li.Size2)}`, -qty, inv ? (inv.Stock + qty) : 0, inv ? inv.Stock : 0, userName, note || `Handed to ${req.staffName}`);
   
           closeModal('fulfillModal');
           renderRequests();
           if (inv) renderShelf();
           renderAuditTable();
   
       } catch (error) {
           console.error('Fulfill error:', error);
           err.querySelector('span').innerText = "An unexpected error occurred. Please try again.";
           err.classList.remove('hidden');
       } finally {
           confirmBtn.disabled = false;
           confirmBtn.innerText = "Confirm";
       }
   }
   
   function toggleRequestCard(cardId) {
       const body = document.getElementById(`req-body-${cardId}`);
       const chev = document.getElementById(`req-chev-${cardId}`);
       const button = body.closest('article').querySelector('button[onclick^="toggleRequestCard"]');
       if (!body) return;
       const willExpand = body.classList.contains('hidden');
       body.classList.toggle('hidden');
       if (chev) chev.classList.toggle('rotate-180');
       if (button) button.setAttribute('aria-expanded', willExpand);
       if (willExpand) expandedRequests.add(cardId);
       else expandedRequests.delete(cardId);
   }
   
   function generateRequestCard(req) {
       const cardId = req.recordId;
       const isExpanded = expandedRequests.has(cardId);
   
       const lineCount = req.items.length;
       const totalUnits = req.items.reduce((a, li) => a + li.qtyRequested, 0);
       const fulfilledUnits = req.items.reduce((a, li) => a + li.qtyFulfilled, 0);
       const progressPct = totalUnits > 0 ? Math.round((fulfilledUnits / totalUnits) * 100) : 0;
   
       let items = "";
       req.items.forEach((li, idx) => {
           const inv = findInventoryItem(li.ItemName, li.Style, li.Size1, li.Size2);
           const stock = inv ? (inv.Stock ?? 0) : 0;
           const reorder = inv ? (inv.Reorder ?? 5) : 5;
           const location = getItemLocation(inv);
           const done = li.qtyFulfilled >= li.qtyRequested;
           const statusBadge = done
               ? `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold"><i class="ph ph-check-circle"></i> Done</span>`
               : `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold">${li.qtyFulfilled} / ${li.qtyRequested}</span>`;
           const btns = done
               ? `<span class="text-xs text-slate-400 font-semibold">Fulfilled</span>`
               : `<button class="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border-2 border-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 btn-hover flex items-center gap-1" onclick="openFulfill('${req.requestId}', ${idx})"><i class="ph ph-hand-palm"></i> Fulfill</button>`;
   
           const noMatchWarning = !inv ? `<span class="text-rose-500 text-xs font-semibold ml-2"><i class="ph ph-warning"></i> No inventory match</span>` : '';
   
           items += `<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4 ${done?'opacity-60':''}">
               <div class="flex-1">
                   <div class="text-sm font-bold">${escapeHtml(li.ItemName)} <span class="font-normal text-slate-500">(${escapeHtml(li.Style)})</span>${noMatchWarning}</div>
                   <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500">
                       <span>Size: <span class="font-mono font-semibold text-slate-700">${escapeHtml(formatSize(li.Size1, li.Size2))}</span></span>
                       <span class="text-slate-300 font-bold">|</span>
                       <span>Req: <strong>${li.qtyRequested}</strong></span>
                       <span class="text-slate-300 font-bold">|</span>
                       <span class="bin-stock-badge ${getStockBadgeClass(stock, reorder)}"><span class="w-2 h-2 rounded-full ${getDotColor(stock, reorder)} inline-block mr-1"></span>${stock}</span>
                       ${location ? `<span class="text-slate-300 font-bold">|</span><span class="inline-flex items-center gap-1 text-indigo-600 font-semibold"><i class="ph ph-map-pin"></i>${escapeHtml(location)}</span>` : ''}
                   </div>
               </div>
               <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">${statusBadge}${btns}</div>
           </div>`;
       });
   
       const typeLabel = req.staffType === 'FT' ? 'Full-Time' : (req.staffType === 'PT' ? 'Part-Time' : 'Unknown');
   
       return `<article class="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow ${req.status==='Complete'?'border-l-4 border-l-emerald-500':''}">
           <button class="w-full px-6 py-4 flex justify-between items-center gap-4 hover:bg-slate-50 text-left" onclick="toggleRequestCard(${cardId})" aria-expanded="${isExpanded}">
               <div class="flex items-center gap-3 min-w-0">
                   <span class="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 shrink-0">${escapeHtml(req.requestId)}</span>
                   <span class="text-sm font-bold truncate">${escapeHtml(req.staffName)}</span>
                   <span class="text-xs text-slate-400 font-semibold hidden sm:inline shrink-0">${typeLabel} - ${req.dateCreated}</span>
               </div>
               <div class="flex items-center gap-2 shrink-0">
                   <span class="text-xs text-slate-500 font-semibold hidden md:inline">${lineCount} item${lineCount===1?'':'s'} - ${fulfilledUnits}/${totalUnits} units</span>
                   ${getStatusBadge(req.status)}
                   <i id="req-chev-${cardId}" class="ph ph-caret-down text-slate-400 transition-transform duration-200 ${isExpanded?'rotate-180':''}"></i>
               </div>
           </button>
           <div class="px-6 pb-3">
               <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                   <div class="h-full bg-indigo-500 rounded-full transition-all duration-300" style="width:${progressPct}%"></div>
               </div>
           </div>
           <div id="req-body-${cardId}" class="${isExpanded?'':'hidden'} px-6 divide-y divide-slate-100">${items}</div>
       </article>`;
   }
   
   function renderRequests() {
       const pend = document.getElementById("pendingRequestsContainer");
       const arch = document.getElementById("archiveRequestsContainer");
       pend.innerHTML = ""; arch.innerHTML = "";
       let pCount = 0, rCount = 0;
       const search = (document.getElementById("archiveSearch").value || "").toLowerCase();
   
       let pendingHtml = "";
       let archiveHtml = "";
   
       requestList.forEach(req => {
           if (req.status === 'Complete' || req.status === 'Empty') {
               rCount++;
               if (`${req.requestId} ${req.staffName}`.toLowerCase().includes(search)) {
                   archiveHtml += generateRequestCard(req);
               }
           } else {
               pCount++;
               pendingHtml += generateRequestCard(req);
           }
       });
   
       pend.innerHTML = pendingHtml;
       arch.innerHTML = archiveHtml;
   
       document.getElementById("navPendingCount").innerText = pCount;
       document.getElementById("resolvedCountBadge").innerText = rCount;
       if (pCount === 0) pend.innerHTML = `<div class="bg-white border-2 border-slate-200 rounded-2xl p-12 text-center shadow-md">
           <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500"><i class="ph ph-check-circle text-3xl"></i></div>
           <h3 class="text-base font-bold mb-1">All caught up</h3>
           <p class="text-sm text-slate-500">No active requests requiring attention.</p>
       </div>`;
   }
   
   // ================================================================
   // STORAGE ROOM
   // ================================================================
   function triggerShelfSearch(val) {
       clearTimeout(shelfSearchTimeout);
       shelfSearchTimeout = setTimeout(() => {
           shelfSearchQuery = val.toLowerCase().trim();
           document.getElementById("clearShelfSearchBtn").classList.toggle('hidden', !shelfSearchQuery);
           renderShelf();
       }, 150);
   }
   
   function clearShelfSearch() {
       document.getElementById("shelfSearchInput").value = "";
       shelfSearchQuery = "";
       document.getElementById("clearShelfSearchBtn").classList.add('hidden');
       renderShelf();
   }
   
    function openBinDetail(binId) {
        const bin = binMap[binId];
        if (!bin) return;
        currentContext = { binId };
        
        document.getElementById("binModalIcon").innerHTML = `<i class="ph-fill ${bin.icon} text-2xl text-slate-600"></i>`;
        document.getElementById("binModalTitle").innerText = bin.label;
        document.getElementById("binModalSubtitle").innerText = `${bin.id} | ${shelfLayout[bin.shelfKey].title}`;
        
        const items = getItemsForBin(binId);
        const binStatus = getBinStockStatus(items);
        document.getElementById("binModalDot").className = `w-2.5 h-2.5 rounded-full ${binStatus.color}`;
        document.getElementById("binModalTotal").innerText = binStatus.total;
        
        renderBinItems(binId);
        openModal('binDetailModal');
    }

   function renderBinItems(binId) {
    const bin = binMap[binId];
    if (!bin) return;
    
    const items = getItemsForBin(binId);
    const container = document.getElementById("binModalItems");
    
    if (items.length === 0) {
        container.innerHTML = `<div class="text-center py-8">
            <p class="text-sm text-slate-400 italic mb-4">No items in this bin yet.</p>
            <button onclick="openAddItemModal('${binId}')" class="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 btn-hover inline-flex items-center gap-2">
                <i class="ph ph-plus"></i> Add First Item
            </button>
        </div>`;
        return;
    }
    
    container.innerHTML = items.map(item => {
        let sizeStr = item.Size1 || '';
        if (item.Size2 && item.Size2 !== 'N/A') sizeStr += ` x ${item.Size2}`;
        const stock = item.Stock ?? 0;
        const reorderLevel = item.Reorder ?? 5;
        const badgeClass = getStockBadgeClass(stock, reorderLevel);
        return `<div class="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate">${escapeHtml(item.ItemName)}</p>
                <p class="text-xs text-slate-500 font-mono">${escapeHtml(sizeStr)} ${item.Style && item.Style !== 'Standard' ? `(${escapeHtml(item.Style)})` : ''}</p>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="quickAdjust('${item.OBJECTID}', -1)" aria-label="Decrease stock" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center border border-slate-200">-</button>
                <span class="bin-stock-badge ${badgeClass}">${stock}</span>
                <button onclick="quickAdjust('${item.OBJECTID}', 1)" aria-label="Increase stock" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center border border-slate-200">+</button>
                <button onclick="openAdjustForItem('${item.OBJECTID}')" aria-label="Bulk adjust" class="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200"><i class="ph ph-wrench text-sm"></i></button>
            </div>
        </div>`;
    }).join('') + `
    <button onclick="openAddItemModal('${binId}')" class="w-full mt-3 px-4 py-3 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-dashed border-slate-300 btn-hover flex items-center justify-center gap-2">
        <i class="ph ph-plus"></i> Add Another Item to ${escapeHtml(bin.label)}
    </button>`;
}
   
   async function quickAdjust(objectId, delta) {
       // In-flight lock
       const objectIdStr = String(objectId);
       if (inFlightAdjustments.has(objectIdStr)) {
           return;
       }
       inFlightAdjustments.add(objectIdStr);
       
       try {
           const item = inventoryIndex.get(objectIdStr);
           if (!item) return;
           const oldStock = item.Stock ?? 0;
           const newStock = Math.max(0, oldStock + delta);
           if (newStock === oldStock) return;
   
           const success = await AGOLClient.updateInventory(item.OBJECTID, {
               Stock: newStock,
               LastAct: delta > 0 ? 'Quick add (+1)' : 'Quick remove (-1)'
           });
   
        if (success) {
            item.Stock = newStock;
            logTransaction(delta > 0 ? "StockAdded" : "StockRemoved", `${item.ItemName} (${item.Style}) ${formatSize(item.Size1, item.Size2)}`, delta, oldStock, newStock, getCurrentUserName(), delta > 0 ? "Quick add (+1)" : "Quick remove (-1)");
            
            // Re-render the bin items to reflect the change
            if (currentContext && currentContext.binId) {
                const items = getItemsForBin(currentContext.binId);
                const binStatus = getBinStockStatus(items);
                document.getElementById("binModalDot").className = `w-2.5 h-2.5 rounded-full ${binStatus.color}`;
                document.getElementById("binModalTotal").innerText = binStatus.total;
                renderBinItems(currentContext.binId);
            }
            renderShelf();
            renderAuditTable();
           } else {
               alert("Stock update failed. Please try again.");
           }
       } finally {
           inFlightAdjustments.delete(objectIdStr);
       }
   }
   
   function openAdjustForItem(objectId) {
       const item = inventoryIndex.get(String(objectId));
       if (!item) return;
       closeModal('binDetailModal');
       currentContext = { objectId: String(objectId) };
       document.getElementById("adjustItemDetails").innerText = `${item.ItemName} (${item.Style})`;
       document.getElementById("adjustCurrentStock").innerText = item.Stock ?? 0;
       document.getElementById("adjustType").value = "add";
       document.getElementById("adjustQty").value = 1;
       document.getElementById("adjustNotes").value = "";
       openModal('adjustModal');
   }
   
   async function confirmAdjust() {
       const { objectId } = currentContext;
       const item = inventoryIndex.get(String(objectId));
       if (!item) return;
       const type = document.getElementById("adjustType").value;
       const qty = parseInt(document.getElementById("adjustQty").value);
       if (isNaN(qty) || qty <= 0) return alert("Enter a valid quantity.");
       const oldStock = item.Stock ?? 0;
       const change = type === 'add' ? qty : -qty;
       const newStock = oldStock + change;
       if (newStock < 0) return alert("Cannot remove more than available.");
   
       const note = document.getElementById("adjustNotes").value || 'Manual adjustment';
       const success = await AGOLClient.updateInventory(item.OBJECTID, { Stock: newStock, LastAct: note });
   
       if (success) {
           item.Stock = newStock;
           logTransaction(type === 'add' ? "StockAdded" : "StockRemoved", `${item.ItemName} (${item.Style}) ${formatSize(item.Size1, item.Size2)}`, change, oldStock, newStock, getCurrentUserName(), note);
           closeModal('adjustModal');
           renderShelf();
           renderAuditTable();
       } else {
           alert("Stock update failed. Please try again.");
       }
   }
   
   function openAddItemModal(binId) {
       const bin = binMap[binId];
       if (!bin) return;
       
       currentContext = { binId };
       populateDatalists();
       
       document.getElementById("addBinLocation").innerText = `${bin.id} - ${bin.label} (${shelfLayout[bin.shelfKey].title})`;
       document.getElementById("addItemName").value = "";
       document.getElementById("addStyle").value = "Standard";
       document.getElementById("addSize1").value = "";
       document.getElementById("addSize2").value = "N/A";
       document.getElementById("addCategory").value = "General";
       document.getElementById("addStock").value = "0";
       document.getElementById("addReorder").value = "5";
       document.getElementById("addNotes").value = "";
       
       const existingItems = getItemsForBin(binId);
       const copySection = document.getElementById("copyFromSection");
       const copySelect = document.getElementById("copyFromSelect");
       
       if (existingItems.length > 0) {
           copySection.classList.remove('hidden');
           copySelect.innerHTML = '<option value="">-- Select an item to copy from --</option>' +
               existingItems.map(item => {
                   let sizeStr = item.Size1 || '';
                   if (item.Size2 && item.Size2 !== 'N/A') sizeStr += ` / ${item.Size2}`;
                   return `<option value="${item.OBJECTID}">${escapeHtml(item.ItemName)} (${escapeHtml(sizeStr)})</option>`;
               }).join('');
       } else {
           copySection.classList.add('hidden');
       }
       
       openModal('addItemModal');
   }
   
   async function confirmAddItem() {
       const { binId } = currentContext;
       
       const itemName = document.getElementById("addItemName").value.trim();
       if (!itemName) return alert("Item name is required.");
       
       const stock = parseInt(document.getElementById("addStock").value) || 0;
       if (stock < 0) return alert("Stock cannot be negative.");
       
       const reorder = parseInt(document.getElementById("addReorder").value) || 5;
       const notes = document.getElementById("addNotes").value.trim();
       
       const confirmBtn = document.querySelector('#addItemModal button[onclick="confirmAddItem()"]');
       confirmBtn.disabled = true;
       confirmBtn.innerText = "Creating...";
       
       try {
           const newItem = {
               ItemName: itemName,
               Style: document.getElementById("addStyle").value || "Standard",
               Size1: document.getElementById("addSize1").value || "",
               Size2: document.getElementById("addSize2").value || "N/A",
               Category: document.getElementById("addCategory").value || "General",
               Bin: binId,
               Stock: stock,
               Reorder: reorder,
               CreatedBy: getCurrentUserName()
           };
           
           const objectId = await AGOLClient.createInventoryItem(newItem);
           
           if (objectId) {
               const fullItem = {
                   OBJECTID: objectId,
                   ...newItem,
                   Active: true,
                   LastAct: `Created via Hub by ${newItem.CreatedBy}`
               };
               
               inventoryData.push(fullItem);
               inventoryIndex.set(String(objectId), fullItem);
               if (!binsByItem.has(binId)) binsByItem.set(binId, []);
               binsByItem.get(binId).push(fullItem);
               
               logTransaction("ItemCreated", itemName, stock, 0, stock, getCurrentUserName(), notes || `Added to ${binId}`);
               closeModal('addItemModal');
               openBinDetail(binId);
               renderShelf();
               renderAuditTable();
               
               alert(`Successfully added "${itemName}" to ${binId}!`);
           } else {
               alert("Failed to create item. Please try again.");
           }
       } catch (error) {
           console.error('Add item error:', error);
           alert("An error occurred while creating the item.");
       } finally {
           confirmBtn.disabled = false;
           confirmBtn.innerText = "Create Item";
       }
   }
   
   function renderShelf() {
       const tabs = document.getElementById("shelfTabs");
       tabs.innerHTML = Object.keys(shelfLayout).map(k => `
           <button onclick="switchShelf('${k}')" class="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${currentShelf === k ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-600 border-2 border-slate-300 hover:bg-slate-50'}">
               ${shelfLayout[k].title}
           </button>
       `).join('');
   
       const container = document.getElementById("shelfContainer");
       const shelf = shelfLayout[currentShelf];
   
       container.innerHTML = `<div class="shelf-unit">` + shelf.rows.map(row => `
           <div class="shelf-row mb-8 last:mb-0">
               <div class="flex items-center mb-4">
                   <span class="shelf-row-label">${row.label}</span>
                   <div class="flex-1 h-px bg-slate-200 ml-4"></div>
               </div>
               <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 justify-items-center px-2 pb-5">
                   ${row.bins.map(bin => {
                       const items = getItemsForBin(bin.id);
                       const binStatus = getBinStockStatus(items);
                       let isMatch = true;
                       if (shelfSearchQuery) {
                           isMatch = (bin.label || '').toLowerCase().includes(shelfSearchQuery) ||
                                     (bin.id || '').toLowerCase().includes(shelfSearchQuery) ||
                                     items.some(i => 
                                         (i.ItemName || '').toLowerCase().includes(shelfSearchQuery) || 
                                         String(i.Size1 || '').toLowerCase().includes(shelfSearchQuery) || 
                                         (i.Style || '').toLowerCase().includes(shelfSearchQuery)
                                     );
                       }
                       const emptyClass = binStatus.total === 0 ? 'empty-bin' : '';
                       return `<div id="bin-card-${bin.id}" class="bin-card ${emptyClass} relative w-44 h-44 rounded-xl flex flex-col items-center justify-between p-4 ${!isMatch ? 'dimmed' : ''} ${shelfSearchQuery && isMatch ? 'highlighted' : ''}" role="button" tabindex="0" aria-label="${escapeHtml(bin.label)}, ${binStatus.total} units" data-bin-id="${bin.id}">
                           <div class="w-full text-right"><span class="text-[10px] font-mono font-bold text-slate-500 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">${bin.id}</span></div>
                           <i class="ph-fill ${bin.icon} text-3xl text-slate-600 my-2"></i>
                           <div class="bin-label w-full text-center py-1.5 rounded-md"><span class="text-xs font-bold text-amber-900 truncate block px-1">${escapeHtml(bin.label)}</span></div>
                           <div class="mt-2"><span class="bin-stock-badge ${binStatus.class}"><span class="w-2 h-2 rounded-full ${binStatus.color} inline-block mr-1.5"></span>${binStatus.total} units</span></div>
                       </div>`;
                   }).join('')}
               </div>
               <div class="shelf-edge mx-2"></div>
           </div>
       `).join('') + `</div>`;
   }
   
   // ================================================================
   // AUDIT LOG
   // ================================================================
   function logTransaction(actionType, itemName, qtyChange, stockBefore, stockAfter, performedBy, notes) {
       actionLog.unshift({ timestamp: new Date().toLocaleString(), actionType, itemName, qtyChange, stockBefore, stockAfter, performedBy, notes });
       saveAuditLog();
   }
   
   function saveAuditLog() {
       try {
           localStorage.setItem('gearHub_auditLog', JSON.stringify(actionLog.slice(0, 200)));
       } catch (e) {
           console.warn('Could not save audit log:', e);
       }
   }
   
   function loadAuditLog() {
       try {
           const stored = localStorage.getItem('gearHub_auditLog');
           if (stored) {
               actionLog = JSON.parse(stored);
           }
       } catch (e) {
           console.warn('Could not load audit log:', e);
           actionLog = [];
       }
   }
   
   function sanitizeForCSV(value) {
       if (value == null) return '';
       let str = String(value);
       // Escape double quotes
       str = str.replace(/"/g, '""');
       // Prevent formula injection
       if (/^[=+\-@]/.test(str)) {
           str = "'" + str;
       }
       return str;
   }
   
   function renderAuditTable() {
       const tbody = document.getElementById("auditBody");
       tbody.innerHTML = "";
       const s = (document.getElementById("auditSearch").value || "").toLowerCase();
       const t = document.getElementById("auditType").value;
       let html = "";
       actionLog.forEach(log => {
           if ((log.itemName.toLowerCase().includes(s) || (log.notes && log.notes.toLowerCase().includes(s))) && (t === "All" || log.actionType === t)) {
               let b = "bg-slate-100 text-slate-700 border border-slate-200", icon = "ph-file-text";
               if (log.actionType.includes("Stock") && log.qtyChange > 0) { b = "bg-emerald-50 text-emerald-700 border border-emerald-200"; icon = "ph-package"; }
               if (log.actionType.includes("Removed")) { b = "bg-rose-50 text-rose-700 border border-rose-200"; icon = "ph-warning"; }
               if (log.actionType === "Fulfilled") { b = "bg-indigo-50 text-indigo-700 border border-indigo-200"; icon = "ph-hand-palm"; }
               if (log.actionType === "InviteSent") { b = "bg-sky-50 text-sky-700 border border-sky-200"; icon = "ph-paper-plane-tilt"; }
               if (log.actionType === "ItemCreated") { b = "bg-purple-50 text-purple-700 border border-purple-200"; icon = "ph-plus-circle"; }
               html += `<tr class="hover:bg-slate-50 transition-colors">
                   <td class="px-6 py-3 text-xs font-mono font-semibold text-slate-500">${log.timestamp}</td>
                   <td class="px-6 py-3"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${b}"><i class="ph ${icon}"></i> ${log.actionType.replace(/([A-Z])/g, ' $1').trim()}</span></td>
                   <td class="px-6 py-3 text-sm font-semibold">${escapeHtml(log.itemName)}</td>
                   <td class="px-6 py-3 text-sm font-bold ${log.qtyChange>0?'text-emerald-700':log.qtyChange<0?'text-rose-700':'text-slate-600'}">${log.qtyChange>0?'+':''}${log.qtyChange}</td>
                   <td class="px-6 py-3 text-xs font-mono font-bold text-slate-600">${log.stockBefore} <i class="ph ph-arrow-right text-slate-400 mx-1"></i> ${log.stockAfter}</td>
                   <td class="px-6 py-3 text-sm font-semibold text-slate-700">${escapeHtml(log.performedBy)}</td>
                   <td class="px-6 py-3 text-sm italic text-slate-500">${escapeHtml(log.notes)||'-'}</td>
               </tr>`;
           }
       });
       tbody.innerHTML = html;
   }
   
   function exportAuditCSV() {
       const headers = "Timestamp,Type,Item,QtyChange,StockBefore,StockAfter,User,Notes";
       const rows = actionLog.map(l => 
           `"${sanitizeForCSV(l.timestamp)}","${sanitizeForCSV(l.actionType)}","${sanitizeForCSV(l.itemName)}",${l.qtyChange},${l.stockBefore},${l.stockAfter},"${sanitizeForCSV(l.performedBy)}","${sanitizeForCSV(l.notes)}"`
       );
       const csv = [headers, ...rows].join('\n');
       const blob = new Blob([csv], { type: 'text/csv' });
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = `audit-log-${Date.now()}.csv`;
       a.click();
       URL.revokeObjectURL(url);
   }
   
   function renderAll() {
       renderRequests();
       renderShelf();
       renderAuditTable();
   }
   
   // ================================================================
   // EVENT DELEGATION
   // ================================================================
   document.addEventListener('click', (e) => {
       const binCard = e.target.closest('.bin-card');
       if (binCard) {
           const binId = binCard.dataset.binId;
           if (binId) openBinDetail(binId);
       }
   });
   
   document.addEventListener('keydown', (e) => {
       if (e.key === 'Escape') {
           ['fulfillModal', 'inviteModal', 'binDetailModal', 'adjustModal', 'addItemModal'].forEach(id => {
               const modal = document.getElementById(id);
               if (modal && !modal.classList.contains('hidden')) closeModal(id);
           });
       }
       
       // Enter/Space for bin cards
       if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('bin-card')) {
           e.preventDefault();
           const binId = e.target.dataset.binId;
           if (binId) openBinDetail(binId);
       }
   });
   
   // ================================================================
   // OAUTH HANDLERS
   // ================================================================
   function setAuthUI(signedIn) {
       const overlay = document.getElementById("signInOverlay");
       const signOutBtn = document.getElementById("signOutBtn");
       if (signedIn) {
           overlay.classList.add("hidden");
           signOutBtn.classList.remove("hidden");
           signOutBtn.classList.add("inline-flex");
       } else {
           overlay.classList.remove("hidden");
           signOutBtn.classList.add("hidden");
           signOutBtn.classList.remove("inline-flex");
       }
   }
   
   function onSignedIn(credential) {
       let displayName = credential.fullName || credential.userId || "User";
       updateUserDisplay(displayName);
       setAuthUI(true);
   
       if (!appInitialized) {
           appInitialized = true;
           init();
       }
   }
   
   function onSignedOut() {
       setAuthUI(false);
   }
   
   function handleSignIn() {
       if (!oauthInfo) {
           alert("Authentication is still loading.");
           return;
       }
       IdentityManager.getCredential(oauthInfo.portalUrl + "/sharing")
           .then(credential => onSignedIn(credential))
           .catch(error => {
               console.error("Sign-in error:", error);
               alert("Sign-in failed. Please try again.");
           });
   }
   
   function handleSignOut() {
       IdentityManager.destroyCredentials();
       window.location.reload();
   }
   
   // ================================================================
   // OAUTH BOOTSTRAP
   // ================================================================
   const oauthInfo = new OAuthInfo({
       appId: OAUTH_CONFIG.clientId,
       popup: false,
       portalUrl: OAUTH_CONFIG.portalUrl,
       expiration: 120
   });
   
   IdentityManager.registerOAuthInfos([oauthInfo]);
   
   IdentityManager.checkSignInStatus(oauthInfo.portalUrl + "/sharing")
       .then(credential => onSignedIn(credential))
       .catch(() => {
           onSignedOut();
           // If we have a 498/499 error from a previous session, trigger sign-in
           if (appInitialized) {
               handleSignIn();
           }
       });
   
   // ================================================================
   // GLOBAL EXPOSURE
   // ================================================================
   window.handleSignIn = handleSignIn;
   window.handleSignOut = handleSignOut;
   window.switchTab = switchTab;
   window.openInviteModal = openInviteModal;
   window.toggleArchive = toggleArchive;
   window.renderRequests = renderRequests;
   window.exportAuditCSV = exportAuditCSV;
   window.renderAuditTable = renderAuditTable;
   window.closeModal = closeModal;
   window.confirmFulfill = confirmFulfill;
   window.sendInvite = sendInvite;
   window.confirmAdjust = confirmAdjust;
   window.triggerShelfSearch = triggerShelfSearch;
   window.clearShelfSearch = clearShelfSearch;
   window.openFulfill = openFulfill;
   window.toggleRequestCard = toggleRequestCard;
   window.renderShelf = renderShelf;
   window.openBinDetail = openBinDetail;
   window.quickAdjust = quickAdjust;
   window.openAddItemModal = openAddItemModal;
   window.confirmAddItem = confirmAddItem;
   window.openAdjustForItem = openAdjustForItem;
   window.updateUserDisplay = updateUserDisplay;
   window.copyFromExisting = copyFromExisting;
   window.retryLoad = retryLoad;
   
   window.switchShelf = function(k) {
       currentShelf = k;
       renderShelf();
   };
