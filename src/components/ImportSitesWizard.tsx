import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, Download, ArrowRight, ArrowLeft, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../hooks/useCompany';
import { logger } from '../lib/logger';
import { useGoogleMapsLoader } from '../lib/google-maps';

interface ImportSitesWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CSVRow {
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: string;
  longitude?: string;
  customSiteId?: string;
  type?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

type WizardStep = 'info' | 'upload' | 'preview' | 'results';

export default function ImportSitesWizard({ isOpen, onClose, onSuccess }: ImportSitesWizardProps) {
  const { currentCompany } = useCompany();
  const { isLoaded: isGoogleMapsLoaded } = useGoogleMapsLoader();
  const [currentStep, setCurrentStep] = useState<WizardStep>('info');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; errors: Array<{ row: number; error: string }> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Template with famous USA locations
  const csvTemplate = `Name,Address,City,State,Zip Code,Country,Latitude,Longitude,Custom Site ID,Type
Statue of Liberty,New York Harbor,New York,NY,10004,USA,40.6892,-74.0445,STATUE-001,company_branch
Golden Gate Bridge,Golden Gate Bridge,San Francisco,CA,94129,USA,37.8199,-122.4783,GG-BRIDGE-001,company_branch
Space Needle,400 Broad St,Seattle,WA,98109,USA,47.6205,-122.3493,SPACE-001,company_branch
Mount Rushmore,13000 SD-244,Keystone,SD,57751,USA,43.8791,-103.4591,MOUNT-001,company_branch
Grand Canyon,Grand Canyon National Park,Grand Canyon,AZ,86023,USA,36.1069,-112.1129,GRAND-001,company_branch
White House,1600 Pennsylvania Avenue NW,Washington,DC,20500,USA,38.8977,-77.0365,WHITE-001,company_branch
Empire State Building,350 5th Ave,New York,NY,10118,USA,40.7484,-73.9857,EMPIRE-001,company_branch
Hollywood Sign,2800 E Observatory Rd,Los Angeles,CA,90027,USA,34.1341,-118.3216,HOLYWOOD-001,company_branch
Times Square,Manhattan,New York,NY,10036,USA,40.7580,-73.9855,TIMES-001,company_branch
Walt Disney World,1375 E Buena Vista Dr,Lake Buena Vista,FL,32830,USA,28.3852,-81.5639,DISNEY-001,company_branch`;

  // Download CSV template
  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'sites_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse CSV file
  const parseCSV = (csvText: string): string[][] => {
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentField = '';
    let inQuote = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuote && nextChar === '"') {
          currentField += '"';
          i++; // Skip the second quote
        } else {
          inQuote = !inQuote;
        }
      } else if (char === ',' && !inQuote) {
        currentLine.push(currentField.trim());
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !inQuote) {
        if (currentField || currentLine.length > 0) {
          currentLine.push(currentField.trim());
          lines.push(currentLine);
        }
        currentLine = [];
        currentField = '';
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n after \r
        }
      } else {
        currentField += char;
      }
    }

    // Add last line if it doesn't end with newline
    if (currentField || currentLine.length > 0) {
      currentLine.push(currentField.trim());
      lines.push(currentLine);
    }

    return lines;
  };

  // Validate CSV data
  const validateCSVData = (rows: string[][]): { valid: CSVRow[]; errors: ValidationError[] } => {
    const valid: CSVRow[] = [];
    const errors: ValidationError[] = [];

    if (rows.length < 2) {
      errors.push({ row: 0, field: 'file', message: 'CSV file must have at least a header row and one data row' });
      return { valid, errors };
    }

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const nameIdx = headers.indexOf('name');
    const addressIdx = headers.indexOf('address');
    const cityIdx = headers.indexOf('city');
    const stateIdx = headers.indexOf('state');
    const zipCodeIdx = headers.indexOf('zip code');
    const countryIdx = headers.indexOf('country');
    const latitudeIdx = headers.indexOf('latitude');
    const longitudeIdx = headers.indexOf('longitude');
    const customSiteIdIdx = headers.indexOf('custom site id');
    const typeIdx = headers.indexOf('type');

    // Validate required headers
    if (nameIdx === -1) {
      errors.push({ row: 1, field: 'header', message: 'Missing required column: Name' });
    }
    if (addressIdx === -1) {
      errors.push({ row: 1, field: 'header', message: 'Missing required column: Address' });
    }
    if (cityIdx === -1) {
      errors.push({ row: 1, field: 'header', message: 'Missing required column: City' });
    }
    if (stateIdx === -1) {
      errors.push({ row: 1, field: 'header', message: 'Missing required column: State' });
    }
    if (zipCodeIdx === -1) {
      errors.push({ row: 1, field: 'header', message: 'Missing required column: Zip Code' });
    }
    if (countryIdx === -1) {
      errors.push({ row: 1, field: 'header', message: 'Missing required column: Country' });
    }

    if (errors.length > 0) {
      return { valid, errors };
    }

    // Validate data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      const rowErrors: ValidationError[] = [];

      if (!row || row.length < headers.length) {
        rowErrors.push({ row: rowNum, field: 'row', message: 'Row has insufficient columns' });
        errors.push(...rowErrors);
        continue;
      }

      const name = row[nameIdx]?.trim() || '';
      const address = row[addressIdx]?.trim() || '';
      const city = row[cityIdx]?.trim() || '';
      const state = row[stateIdx]?.trim() || '';
      const zipCode = row[zipCodeIdx]?.trim() || '';
      const country = row[countryIdx]?.trim() || '';
      const latitude = row[latitudeIdx]?.trim() || '';
      const longitude = row[longitudeIdx]?.trim() || '';
      const customSiteId = row[customSiteIdIdx]?.trim() || '';
      const type = row[typeIdx]?.trim() || 'company_branch';

      // Validate required fields
      if (!name) {
        rowErrors.push({ row: rowNum, field: 'name', message: 'Name is required' });
      }
      if (!address) {
        rowErrors.push({ row: rowNum, field: 'address', message: 'Address is required' });
      }
      if (!city) {
        rowErrors.push({ row: rowNum, field: 'city', message: 'City is required' });
      }
      if (!state) {
        rowErrors.push({ row: rowNum, field: 'state', message: 'State is required' });
      }
      if (!zipCode) {
        rowErrors.push({ row: rowNum, field: 'zipCode', message: 'Zip Code is required' });
      }
      if (!country) {
        rowErrors.push({ row: rowNum, field: 'country', message: 'Country is required' });
      }

      // Validate coordinates if provided
      if (latitude && isNaN(Number(latitude))) {
        rowErrors.push({ row: rowNum, field: 'latitude', message: 'Latitude must be a valid number' });
      }
      if (longitude && isNaN(Number(longitude))) {
        rowErrors.push({ row: rowNum, field: 'longitude', message: 'Longitude must be a valid number' });
      }
      if (latitude && (Number(latitude) < -90 || Number(latitude) > 90)) {
        rowErrors.push({ row: rowNum, field: 'latitude', message: 'Latitude must be between -90 and 90' });
      }
      if (longitude && (Number(longitude) < -180 || Number(longitude) > 180)) {
        rowErrors.push({ row: rowNum, field: 'longitude', message: 'Longitude must be between -180 and 180' });
      }

      // Validate type
      if (type && type !== 'company_branch' && type !== 'customer_site') {
        rowErrors.push({ row: rowNum, field: 'type', message: 'Type must be either "company_branch" or "customer_site"' });
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      valid.push({
        name,
        address,
        city,
        state,
        zipCode,
        country,
        latitude: latitude || undefined,
        longitude: longitude || undefined,
        customSiteId: customSiteId || undefined,
        type: type || 'company_branch',
      });
    }

    return { valid, errors };
  };

  // Geocode address using Google Maps
  const geocodeAddress = async (address: string, city: string, state: string, zipCode: string, country: string): Promise<{ lat: number; lng: number } | null> => {
    if (!isGoogleMapsLoaded || !window.google?.maps?.Geocoder) {
      return null;
    }

    return new Promise((resolve) => {
      const fullAddress = `${address}, ${city}, ${state} ${zipCode}, ${country}`;
      const geocoder = new google.maps.Geocoder();
      
      geocoder.geocode({ address: fullAddress }, (results, status) => {
        if (status === 'OK' && results && results[0]?.geometry?.location) {
          const location = results[0].geometry.location;
          resolve({
            lat: location.lat(),
            lng: location.lng(),
          });
        } else {
          logger.warn('Geocoding failed', { address: fullAddress, status });
          resolve(null);
        }
      });
    });
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setValidationErrors([]);
    setCsvData([]);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const { valid, errors } = validateCSVData(rows);

      setValidationErrors(errors);
      setCsvData(valid);

      if (valid.length > 0) {
        setCurrentStep('preview');
      }
    } catch (err: any) {
      logger.error('Error parsing CSV', err);
      setValidationErrors([{ row: 0, field: 'file', message: err?.message || 'Failed to parse CSV file' }]);
    }
  };

  // Process and import sites
  const handleImport = async () => {
    if (!currentCompany?.id) {
      alert('No company selected');
      return;
    }

    setIsImporting(true);
    setCurrentStep('results');

    try {
      const errors: Array<{ row: number; error: string }> = [];
      const sitesToCreate: any[] = [];

      // First, fetch all existing sites for this company to check for duplicates
      const { data: existingSites, error: fetchError } = await supabase
        .from('sites')
        .select('site_name, site_address')
        .eq('company_id', currentCompany.id)
        .eq('is_deleted', false);

      if (fetchError) {
        throw fetchError;
      }

      // Create sets for quick lookup
      const existingSiteNames = new Set(
        (existingSites || [])
          .map(s => s.site_name?.toLowerCase().trim())
          .filter(Boolean)
      );

      // Track site names in the current import batch to detect duplicates within the CSV
      const batchSiteNames = new Set<string>();

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        if (!row) continue;
        const rowNum = i + 2; // +2 because header is row 1

        try {
          // Check for duplicate site name within company
          const siteNameLower = row.name.trim().toLowerCase();
          if (existingSiteNames.has(siteNameLower)) {
            errors.push({ row: rowNum, error: `Site name "${row.name.trim()}" already exists in this company` });
            continue;
          }
          if (batchSiteNames.has(siteNameLower)) {
            errors.push({ row: rowNum, error: `Site name "${row.name.trim()}" is duplicated in this CSV file` });
            continue;
          }
          batchSiteNames.add(siteNameLower);

          // Get coordinates - use provided or geocode
          let latitude: number | null = null;
          let longitude: number | null = null;

          if (row.latitude && row.longitude) {
            latitude = Number(row.latitude);
            longitude = Number(row.longitude);
          } else {
            // Geocode the address
            const coords = await geocodeAddress(row.address, row.city, row.state, row.zipCode, row.country);
            if (coords) {
              latitude = coords.lat;
              longitude = coords.lng;
            } else {
              // Still create the site without coordinates
              logger.warn('Could not geocode address', { address: row.address, row: rowNum });
            }
          }

          // Parse radius meters
          let radiusMeters: number | null = null;
          if (row.radiusMeters) {
            radiusMeters = Number(row.radiusMeters);
          }

          // Validate and set type
          const siteType = row.type === 'customer_site' ? 'customer_site' : 'company_branch';

          sitesToCreate.push({
            site_name: row.name.trim(),
            site_address: `${row.address}, ${row.city}, ${row.state} ${row.zipCode}`,
            city: row.city.trim(),
            state: row.state.trim(),
            zip_code: row.zipCode.trim(),
            country: row.country.trim(),
            latitude: latitude,
            longitude: longitude,
            custom_site_id: row.customSiteId?.trim() || null,
            type: siteType,
            company_id: currentCompany.id,
            is_active: true,
            is_deleted: false,
            archived: false,
          });
        } catch (err: any) {
          errors.push({ row: rowNum, error: err?.message || 'Unknown error' });
        }
      }

      // Create sites in batch
      if (sitesToCreate.length > 0) {
        const { data, error: insertError } = await supabase
          .from('sites')
          .insert(sitesToCreate)
          .select();

        if (insertError) {
          throw insertError;
        }

        logger.info('Sites imported', { count: sitesToCreate.length });
      }

      setImportResults({
        success: sitesToCreate.length,
        errors,
      });

      if (sitesToCreate.length > 0) {
        onSuccess(); // Refresh the sites list
      }
    } catch (err: any) {
      logger.error('Error importing sites', err);
      setImportResults({
        success: 0,
        errors: [{ row: 0, error: err?.message || 'Failed to import CSV file' }],
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Reset wizard
  const handleClose = () => {
    setCurrentStep('info');
    setCsvFile(null);
    setCsvData([]);
    setValidationErrors([]);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Import Sites</h3>
              <p className="text-sm text-gray-500">Import sites from CSV file</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'info' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
            }`}>
              {currentStep !== 'info' ? <CheckCircle className="w-4 h-4" /> : '1'}
            </div>
            <div className={`w-16 h-1 ${currentStep !== 'info' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'upload' ? 'bg-blue-600 text-white' : 
              currentStep === 'preview' || currentStep === 'results' ? 'bg-green-600 text-white' : 
              'bg-gray-200 text-gray-600'
            }`}>
              {currentStep === 'preview' || currentStep === 'results' ? <CheckCircle className="w-4 h-4" /> : '2'}
            </div>
            <div className={`w-16 h-1 ${currentStep === 'preview' || currentStep === 'results' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'preview' ? 'bg-blue-600 text-white' : 
              currentStep === 'results' ? 'bg-green-600 text-white' : 
              'bg-gray-200 text-gray-600'
            }`}>
              {currentStep === 'results' ? <CheckCircle className="w-4 h-4" /> : '3'}
            </div>
            <div className={`w-16 h-1 ${currentStep === 'results' ? 'bg-green-600' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep === 'results' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              4
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          {/* Step 1: Info */}
          {currentStep === 'info' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-2">Step 1: Download Template</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Download our CSV template to ensure your file has the correct format. The template includes example data with famous USA locations to guide you.
                </p>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <FileText className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="font-semibold text-blue-900 mb-3">Column Requirements</h5>
                    
                    <div className="mb-4">
                      <h6 className="text-sm font-medium text-blue-900 mb-2">Required Columns:</h6>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-gray-900">Name</span>
                          <span className="text-xs text-gray-500">(Required)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-gray-900">Address</span>
                          <span className="text-xs text-gray-500">(Required)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-gray-900">City</span>
                          <span className="text-xs text-gray-500">(Required)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-gray-900">State</span>
                          <span className="text-xs text-gray-500">(Required)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-gray-900">Zip Code</span>
                          <span className="text-xs text-gray-500">(Required)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-gray-900">Country</span>
                          <span className="text-xs text-gray-500">(Required)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h6 className="text-sm font-medium text-blue-900 mb-2">Optional Columns:</h6>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700">Latitude</span>
                          <span className="text-xs text-gray-500">(If not provided, will be geocoded from address)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700">Longitude</span>
                          <span className="text-xs text-gray-500">(If not provided, will be geocoded from address)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700">Custom Site ID</span>
                          <span className="text-xs text-gray-500">(Optional - for client integration)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700">Type</span>
                          <span className="text-xs text-gray-500">(company_branch or customer_site, default: company_branch)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </button>
                  <button
                    onClick={() => {
                      setCurrentStep('upload');
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded text-white transition-colors"
                    style={{ backgroundColor: 'var(--primary-brand-hex)' }}
                  >
                    Next: Upload CSV
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Upload */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-2">Step 2: Upload CSV File</h4>
                <p className="text-sm text-gray-600">
                  Select your CSV file to import sites.
                </p>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  {csvFile ? `Selected: ${csvFile.name}` : 'Click to select CSV file'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  aria-label="Upload CSV file"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                >
                  {csvFile ? 'Change File' : 'Select File'}
                </button>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep('info')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                {csvFile && (
                  <button
                    onClick={() => setCurrentStep('preview')}
                    className="flex items-center gap-2 px-4 py-2 rounded text-white transition-colors"
                    style={{ backgroundColor: 'var(--primary-brand-hex)' }}
                  >
                    Next: Review
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {currentStep === 'preview' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-2">Step 3: Review Data</h4>
                <p className="text-sm text-gray-600">
                  Review the data below. Invalid rows will be skipped during import.
                </p>
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Validation Errors ({validationErrors.length})</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <ul className="space-y-1 text-sm">
                      {validationErrors.map((error, idx) => (
                        <li key={idx} className="text-red-700">
                          <strong>Row {error.row}:</strong> {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-900">
                    Preview ({csvData.length} valid rows)
                  </span>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Address</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">City</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">State</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Country</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Custom ID</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Coordinates</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-gray-700">{row.name}</td>
                          <td className="px-3 py-2 text-gray-700">{row.address}</td>
                          <td className="px-3 py-2 text-gray-700">{row.city}</td>
                          <td className="px-3 py-2 text-gray-700">{row.state}</td>
                          <td className="px-3 py-2 text-gray-700">{row.country}</td>
                          <td className="px-3 py-2 text-gray-700">{row.customSiteId || '—'}</td>
                          <td className="px-3 py-2 text-gray-700">
                            {row.latitude && row.longitude 
                              ? `${row.latitude}, ${row.longitude}` 
                              : <span className="text-gray-400">Will be geocoded</span>}
                          </td>
                        </tr>
                      ))}
                      {csvData.length > 10 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-2 text-center text-xs text-gray-500">
                            ... and {csvData.length - 10} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep('upload')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={csvData.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--primary-brand-hex)' }}
                >
                  Import {csvData.length} Sites
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Results */}
          {currentStep === 'results' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-2">Import Complete</h4>
              </div>

              {isImporting ? (
                <div className="text-center py-12">
                  <Loader className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Importing sites...</p>
                </div>
              ) : importResults ? (
                <>
                  {importResults.success > 0 && (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Successfully imported {importResults.success} site(s)</span>
                    </div>
                  )}

                  {importResults.errors.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-red-600 mb-2">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">Errors ({importResults.errors.length})</span>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                        <ul className="space-y-1 text-sm">
                          {importResults.errors.map((error, idx) => (
                            <li key={idx} className="text-red-700">
                              <strong>Row {error.row}:</strong> {error.error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={handleClose}
                      className="px-4 py-2 rounded text-white transition-colors"
                      style={{ backgroundColor: 'var(--primary-brand-hex)' }}
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

