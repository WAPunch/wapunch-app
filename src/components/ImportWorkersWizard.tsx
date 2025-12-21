import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, Download, ArrowRight, ArrowLeft, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../hooks/useCompany';
import { useDepartments } from '../hooks/useDepartments';
import { useJobTitles } from '../hooks/useJobTitles';
import { logger } from '../lib/logger';
import phoneRules from '../../phone_number_rules_global_full.json';

interface ImportWorkersWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CSVRow {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  workerType: 'employee' | 'contractor';
  department: string;
  jobTitle: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

type WizardStep = 'info' | 'upload' | 'preview' | 'results';

export default function ImportWorkersWizard({ isOpen, onClose, onSuccess }: ImportWorkersWizardProps) {
  const { currentCompany } = useCompany();
  const { departments, addDepartment } = useDepartments();
  const { jobTitles, addJobTitle } = useJobTitles();
  const [currentStep, setCurrentStep] = useState<WizardStep>('info');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; errors: Array<{ row: number; error: string }> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Template
  const csvTemplate = `First Name,Last Name,Email,Phone,Worker Type,Department,Job Title
John,Smith,john.smith@company.com,+13055550101,employee,Construction,Project Manager
Maria,Garcia,maria.garcia@company.com,+12125550125,employee,Construction,Foreman
David,Johnson,david.johnson@company.com,+13105550148,contractor,Construction,Heavy Equipment Operator
Sarah,Williams,sarah.williams@company.com,+14155550162,employee,Safety,Safety Coordinator
Michael,Brown,michael.brown@company.com,+13125550177,employee,Construction,Construction Worker
Emily,Davis,emily.davis@company.com,+17135550193,employee,Engineering,Civil Engineer
James,Wilson,james.wilson@company.com,+12025550114,contractor,Construction,Concrete Finisher
Lisa,Moore,lisa.moore@company.com,+14045550139,employee,Construction,Equipment Operator`;

  // Download CSV template
  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'workers_import_template.csv');
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

    // Add last field and line
    if (currentField || currentLine.length > 0) {
      currentLine.push(currentField.trim());
      lines.push(currentLine);
    }

    return lines;
  };

  // Detect country code from phone number
  const detectCountryCodeFromNumber = (fullNumber: string): { countryCode: string; phoneNumber: string } => {
    const digits = fullNumber.replace(/\D/g, '');
    
    if (!digits) {
      return { countryCode: '+1', phoneNumber: '' };
    }

    // Use the full phoneRules list for detection
    const sortedCodes = [...phoneRules.rules].sort((a, b) => {
      const aDigits = a.calling_code.replace(/\D/g, '').length;
      const bDigits = b.calling_code.replace(/\D/g, '').length;
      return bDigits - aDigits; // Longer codes first
    });

    for (const rule of sortedCodes) {
      const codeDigits = rule.calling_code.replace(/\D/g, '');
      if (digits.startsWith(codeDigits)) {
        const phoneNumber = digits.substring(codeDigits.length);
        if (phoneNumber.length >= 4) { // Minimum valid number length
          return { countryCode: rule.calling_code, phoneNumber };
        }
      }
    }

    // Fallback if no specific country code is detected
    if (digits.length >= 10) { // Assume +1 for 10-digit numbers if no other code detected
      return { countryCode: '+1', phoneNumber: digits.substring(digits.length - 10) };
    }
    
    return { countryCode: '+1', phoneNumber: digits };
  };

  // Clean phone number (remove all non-numeric characters)
  const cleanPhoneNumber = (phoneNumber: string): string => {
    return phoneNumber.replace(/\D/g, '');
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    setCsvFile(file);
    
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      if (rows.length < 2 || !rows[0]) {
        throw new Error('CSV file must have at least a header row and one data row');
      }

      const headers = rows[0].map(h => h.trim().toLowerCase());
      
      // Find column indices
      const firstNameIdx = headers.findIndex(h => h.includes('first') && h.includes('name'));
      const lastNameIdx = headers.findIndex(h => h.includes('last') && h.includes('name'));
      const emailIdx = headers.findIndex(h => h.includes('email'));
      const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('tel'));
      const workerTypeIdx = headers.findIndex(h => (h.includes('worker') && h.includes('type')) || (h.includes('type') && !h.includes('job')));
      const departmentIdx = headers.findIndex(h => h.includes('department'));
      const jobTitleIdx = headers.findIndex(h => (h.includes('job') && h.includes('title')) || h.includes('position') || h.includes('role'));

      // Validate required columns
      if (firstNameIdx === -1 || lastNameIdx === -1) {
        throw new Error('CSV must contain "First Name" and "Last Name" columns');
      }

      if (phoneIdx === -1) {
        throw new Error('CSV must contain a "Phone" column');
      }

      // Parse data rows
      const parsedData: CSVRow[] = [];
      const errors: ValidationError[] = [];

      rows.slice(1).forEach((row, index) => {
        if (!row) return; // Skip empty rows
        const rowNum = index + 2; // +2 because we start from row 2 (header is row 1)
        const firstName = row[firstNameIdx]?.trim() || '';
        const lastName = row[lastNameIdx]?.trim() || '';
        const email = emailIdx >= 0 ? (row[emailIdx]?.trim() || '') : '';
        const phone = row[phoneIdx]?.trim() || '';
        const workerType = workerTypeIdx >= 0 ? (row[workerTypeIdx]?.trim().toLowerCase() || 'employee') : 'employee';
        const department = departmentIdx >= 0 ? (row[departmentIdx]?.trim() || '') : '';
        const jobTitle = jobTitleIdx >= 0 ? (row[jobTitleIdx]?.trim() || '') : '';

        // Validation
        if (!firstName) {
          errors.push({ row: rowNum, field: 'firstName', message: 'First name is required' });
        }
        if (!lastName) {
          errors.push({ row: rowNum, field: 'lastName', message: 'Last name is required' });
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({ row: rowNum, field: 'email', message: 'Invalid email format' });
        }
        if (!phone) {
          errors.push({ row: rowNum, field: 'phone', message: 'Phone number is required' });
        }
        if (workerType && workerType !== 'employee' && workerType !== 'contractor') {
          errors.push({ row: rowNum, field: 'workerType', message: 'Worker type must be "employee" or "contractor"' });
        }

        if (errors.filter(e => e.row === rowNum).length === 0) {
          parsedData.push({
            firstName,
            lastName,
            email: email || '',
            phone,
            workerType: (workerType === 'contractor' ? 'contractor' : 'employee') as 'employee' | 'contractor',
            department: department || '',
            jobTitle: jobTitle || '',
          });
        }
      });

      setCsvData(parsedData);
      setValidationErrors(errors);
      setCurrentStep('preview');
    } catch (err: any) {
      alert(`Error reading CSV: ${err?.message || 'Unknown error'}`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setCsvFile(null);
    }
  };

  // Process and import workers
  const handleImport = async () => {
    if (!currentCompany?.id) {
      alert('No company selected');
      return;
    }

    setIsImporting(true);
    setCurrentStep('results');

    try {
      const errors: Array<{ row: number; error: string }> = [];
      const workersToCreate: any[] = [];

      // First, fetch all existing workers for this company to check for duplicates
      const { data: existingWorkers, error: fetchError } = await supabase
        .from('workers')
        .select('email, whatsapp_number')
        .eq('company_id', currentCompany.id)
        .eq('is_deleted', false);

      if (fetchError) {
        throw fetchError;
      }

      // Create sets for quick lookup
      const existingEmails = new Set(
        (existingWorkers || [])
          .filter(w => w.email)
          .map(w => w.email?.toLowerCase().trim())
      );
      const existingPhones = new Set(
        (existingWorkers || [])
          .filter(w => w.whatsapp_number)
          .map(w => w.whatsapp_number)
      );

      // Track emails and phones in the current import batch to detect duplicates within the CSV
      const batchEmails = new Set<string>();
      const batchPhones = new Set<string>();

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        if (!row) continue; // Skip if row is undefined
        const rowNum = i + 2; // +2 because header is row 1

        try {
          // Process phone number
          let phoneCountryCode = '+1';
          let phoneNumber = '';

          if (row.phone) {
            if (row.phone.startsWith('+')) {
              const detected = detectCountryCodeFromNumber(row.phone);
              phoneCountryCode = detected.countryCode;
              phoneNumber = detected.phoneNumber;
            } else {
              const detected = detectCountryCodeFromNumber(row.phone);
              phoneCountryCode = detected.countryCode;
              phoneNumber = detected.phoneNumber;
            }
          }

          if (!phoneNumber) {
            errors.push({ row: rowNum, error: 'Valid phone number is required' });
            continue;
          }

          // Get or create department
          let departmentId: string | null = null;
          if (row.department) {
            const existingDept = departments.find(d => d.name.toLowerCase() === row.department.toLowerCase());
            if (existingDept) {
              departmentId = existingDept.id;
            } else {
              try {
                departmentId = await addDepartment(row.department);
              } catch (err) {
                errors.push({ row: rowNum, error: `Failed to create department: ${row.department}` });
                continue;
              }
            }
          }

          // Get or create job title
          let jobTitleId: string | null = null;
          if (row.jobTitle) {
            const existingJobTitle = jobTitles.find(j => j.name.toLowerCase() === row.jobTitle.toLowerCase());
            if (existingJobTitle) {
              jobTitleId = existingJobTitle.id;
            } else {
              try {
                jobTitleId = await addJobTitle(row.jobTitle);
              } catch (err) {
                errors.push({ row: rowNum, error: `Failed to create job title: ${row.jobTitle}` });
                continue;
              }
            }
          }

          // Format phone for database (remove + and all non-numeric characters)
          const cleanedPhoneNumber = cleanPhoneNumber(phoneNumber);
          const countryCodeDigits = phoneCountryCode.replace(/\D/g, '');
          const whatsappNumber = countryCodeDigits + cleanedPhoneNumber;

          // Check for duplicate email within company (if email is provided)
          if (row.email.trim()) {
            const emailLower = row.email.trim().toLowerCase();
            if (existingEmails.has(emailLower)) {
              errors.push({ row: rowNum, error: `Email "${row.email.trim()}" already exists in this company` });
              continue;
            }
            if (batchEmails.has(emailLower)) {
              errors.push({ row: rowNum, error: `Email "${row.email.trim()}" is duplicated in this CSV file` });
              continue;
            }
            batchEmails.add(emailLower);
          }

          // Check for duplicate phone number within company
          if (existingPhones.has(whatsappNumber)) {
            errors.push({ row: rowNum, error: `Phone number already exists in this company` });
            continue;
          }
          if (batchPhones.has(whatsappNumber)) {
            errors.push({ row: rowNum, error: `Phone number is duplicated in this CSV file` });
            continue;
          }
          batchPhones.add(whatsappNumber);

          workersToCreate.push({
            first_name: row.firstName.trim(),
            last_name: row.lastName.trim(),
            email: row.email.trim() || null,
            whatsapp_number: whatsappNumber,
            worker_type: row.workerType,
            department_id: departmentId,
            job_title_id: jobTitleId,
            company_id: currentCompany.id,
            is_active: true,
            is_deleted: false,
          });
        } catch (err: any) {
          errors.push({ row: rowNum, error: err?.message || 'Unknown error' });
        }
      }

      // Create workers in batch
      if (workersToCreate.length > 0) {
        const { data, error: insertError } = await supabase
          .from('workers')
          .insert(workersToCreate)
          .select();

        if (insertError) {
          throw insertError;
        }

        logger.info('Workers imported', { count: workersToCreate.length });
      }

      setImportResults({
        success: workersToCreate.length,
        errors,
      });

      if (workersToCreate.length > 0) {
        onSuccess(); // Refresh the worker list
      }
    } catch (err: any) {
      logger.error('Error importing workers', err);
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
      // Save current overflow style
      const originalOverflow = document.body.style.overflow;
      // Disable scroll
      document.body.style.overflow = 'hidden';
      
      // Cleanup: restore scroll when modal closes
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
              <h3 className="text-lg font-semibold text-gray-900">Import Workers</h3>
              <p className="text-sm text-gray-500">Import workers from CSV file</p>
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
                  Download our CSV template to ensure your file has the correct format. The template includes example data to guide you.
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
                          <span className="text-sm font-medium text-gray-900">First Name</span>
                          <span className="text-xs text-gray-500">(Required)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-gray-900">Last Name</span>
                          <span className="text-xs text-gray-500">(Required)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-gray-900">Phone</span>
                          <span className="text-xs text-gray-500">(Required - with country code, e.g., +15071234567)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h6 className="text-sm font-medium text-blue-900 mb-2">Optional Columns:</h6>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700">Email</span>
                          <span className="text-xs text-gray-500">(Optional)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700">Worker Type</span>
                          <span className="text-xs text-gray-500">(employee or contractor, default: employee)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700">Department</span>
                          <span className="text-xs text-gray-500">(will be created if it doesn't exist)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-700">Job Title</span>
                          <span className="text-xs text-gray-500">(will be created if it doesn't exist)</span>
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
                  Select your CSV file to import workers.
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
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">First Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Last Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Email</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Phone</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Department</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Job Title</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-gray-700">{row.firstName}</td>
                          <td className="px-3 py-2 text-gray-700">{row.lastName}</td>
                          <td className="px-3 py-2 text-gray-700">{row.email || '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{row.phone}</td>
                          <td className="px-3 py-2 text-gray-700">{row.workerType}</td>
                          <td className="px-3 py-2 text-gray-700">{row.department || '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{row.jobTitle || '—'}</td>
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
                  Import {csvData.length} Workers
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
                  <p className="text-gray-600">Importing workers...</p>
                </div>
              ) : importResults ? (
                <>
                  {importResults.success > 0 && (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-lg border border-green-200">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Successfully imported {importResults.success} worker(s)</span>
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

