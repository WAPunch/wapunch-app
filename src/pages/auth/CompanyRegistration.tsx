import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Building,
  Users,
  Mail, 
  Phone, 
  Lock, 
  Eye, 
  EyeOff, 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Globe,
  Hash,
  X
} from 'lucide-react';
import { Box } from 'lucide-react';
import taxIdRules from '../../../tax_id_rules_global_en.json';
import phoneRules from '../../../phone_number_rules_global_full.json';
import blockedEmailDomains from '../../../blocked_email_domains_for_company_registration.json';

export default function CompanyRegistration() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    companyName: '',
    country: '',
    industry: '',
    companySize: '',
    contactFirstName: '',
    contactLastName: '',
    contactEmail: '',
    website: '',
    phoneCountryCode: '',
    phoneNumber: '',
    businessRegistrationNumber: '',
    corporateEmail: '',
    password: '',
    confirmPassword: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [taxIdDocument, setTaxIdDocument] = useState<File | null>(null);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [isPartOfGroup, setIsPartOfGroup] = useState(false);
  const [groupCode, setGroupCode] = useState('');
  const [cameFromLogin, setCameFromLogin] = useState(false);
  const [vapCode, setVapCode] = useState('');

  // Detect if user came from login page
  useEffect(() => {
    const referrer = document.referrer;
    const currentOrigin = window.location.origin;
    const loginPage = `${currentOrigin}/login`;
    
    if (referrer === loginPage) {
      setCameFromLogin(true);
    }
  }, []);
  const [referralCode, setReferralCode] = useState('');
  const [userMode, setUserMode] = useState<'new_user' | 'existing_user' | null>(null);
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const totalSteps = 5;

  // Industry options
  const industryOptions = [
    'Agriculture & Forestry',
    'Architecture & Interior Design',
    'Arts & Culture',
    'Business Services (BPO, HR, Facilities)',
    'Construction',
    'Education & Training',
    'Electronics & Hardware',
    'Energy & Utilities',
    'Financial Services & Banking',
    'Food & Beverage',
    'Government & Public Sector',
    'Healthcare & Medical',
    'Hospitality & Tourism',
    'Information Technology & Software',
    'Insurance',
    'Internet Services & SaaS',
    'Marketing & Advertising',
    'Manufacturing',
    'Media & Entertainment',
    'Mining & Metals',
    'Nonprofit & NGOs',
    'Personal Services',
    'Pharmaceuticals & Biotech',
    'Professional Services (Consulting, Legal, Accounting)',
    'Real Estate & Property Management',
    'Retail & eCommerce',
    'Telecommunications',
    'Transportation & Logistics',
    'Wholesale & Distribution',
    'Other / Not Listed'
  ];

  // Company size options
  const companySizeOptions = [
    '1-10 employees',
    '11-50 employees',
    '51-200 employees',
    '201-500 employees',
    '501-1000 employees',
    '1001-5000 employees',
    '5000+ employees'
  ];

  // Función para obtener la información del Tax ID según el país
  const getTaxIdInfo = (countryCode: string) => {
    const rule = taxIdRules.rules.find(rule => rule.country_code === countryCode);
    return rule || taxIdRules.fallback;
  };

  // Función para obtener la información del teléfono según el código de país
  const getPhoneInfo = (callingCode: string) => {
    const rule = phoneRules.rules.find(rule => rule.calling_code === callingCode);
    return rule || phoneRules.fallback;
  };

  // Función para obtener el país seleccionado
  const getSelectedCountry = (callingCode: string) => {
    return phoneCountryCodes.find(country => country.code === callingCode);
  };

  // Función para limpiar el número de teléfono (solo números)
  const cleanPhoneNumber = (phoneNumber: string) => {
    return phoneNumber.replace(/\D/g, '');
  };

  // Función para validar el número de teléfono
  const validatePhoneNumber = (phoneNumber: string, callingCode: string) => {
    const cleanNumber = cleanPhoneNumber(phoneNumber);
    const phoneInfo = getPhoneInfo(callingCode);
    
    if (!phoneInfo.national_number_pattern) {
      return { isValid: true, error: '' };
    }

    const regex = new RegExp(phoneInfo.national_number_pattern);
    const isValid = regex.test(cleanNumber);
    
    if (!isValid) {
      const expectedLength = phoneInfo.national_number_pattern.match(/\d{(\d+),(\d+)}/);
      if (expectedLength && expectedLength[1] && expectedLength[2]) {
        const minLength = parseInt(expectedLength[1]);
        const maxLength = parseInt(expectedLength[2]);
        if (cleanNumber.length < minLength) {
          return { 
            isValid: false, 
            error: `Phone number must be at least ${minLength} digits` 
          };
        } else if (cleanNumber.length > maxLength) {
          return { 
            isValid: false, 
            error: `Phone number must be no more than ${maxLength} digits` 
          };
        }
      }
      return { 
        isValid: false, 
        error: `Invalid phone number format for ${callingCode}` 
      };
    }
    
    return { isValid: true, error: '' };
  };

  // Función para validar dominios de correo bloqueados
  const validateEmailDomain = (email: string) => {
    const domain = email.toLowerCase().split('@')[1];
    
    if (!domain) {
      return { isValid: false, error: 'Invalid email format' };
    }

    // Verificar si el dominio está en la lista de bloqueados
    const isBlocked = blockedEmailDomains.blocked_domains.some(blockedDomain => {
      const cleanBlockedDomain = blockedDomain.replace('@', '').toLowerCase();
      return domain === cleanBlockedDomain;
    });

    if (isBlocked) {
      return { 
        isValid: false, 
        error: 'Please use a corporate email address. Personal email providers (Gmail, Yahoo, etc.) are not allowed for company registration.' 
      };
    }

    return { isValid: true, error: '' };
  };

  // Función para obtener el nombre del país desde el código
  const getCountryName = (countryCode: string) => {
    const countryNames: Record<string, string> = {
      'US': 'United States',
      'CA': 'Canada', 
      'GB': 'United Kingdom',
      'DE': 'Germany',
      'FR': 'France',
      'ES': 'Spain',
      'IT': 'Italy',
      'NL': 'Netherlands',
      'BE': 'Belgium',
      'CH': 'Switzerland',
      'AU': 'Australia',
      'JP': 'Japan',
      'KR': 'South Korea',
      'SG': 'Singapore',
      'MX': 'Mexico',
      'BR': 'Brazil',
      'AR': 'Argentina',
      'CL': 'Chile',
      'CO': 'Colombia',
      'PE': 'Peru',
      'PA': 'Panama',
      'EC': 'Ecuador',
      'UY': 'Uruguay',
      'PY': 'Paraguay',
      'BO': 'Bolivia',
      'VE': 'Venezuela',
      'CR': 'Costa Rica',
      'GT': 'Guatemala',
      'HN': 'Honduras',
      'SV': 'El Salvador',
      'NI': 'Nicaragua',
      'CU': 'Cuba',
      'DO': 'Dominican Republic',
      'HT': 'Haiti',
      'JM': 'Jamaica',
      'TT': 'Trinidad and Tobago',
      'BB': 'Barbados',
      'BS': 'Bahamas',
      'BZ': 'Belize',
      'GY': 'Guyana',
      'SR': 'Suriname',
      'FK': 'Falkland Islands',
      'GF': 'French Guiana',
      'GP': 'Guadeloupe',
      'MQ': 'Martinique',
      'BL': 'Saint Barthélemy',
      'MF': 'Saint Martin',
      'PM': 'Saint Pierre and Miquelon',
      'VC': 'Saint Vincent and the Grenadines',
      'LC': 'Saint Lucia',
      'KN': 'Saint Kitts and Nevis',
      'AG': 'Antigua and Barbuda',
      'DM': 'Dominica',
      'GD': 'Grenada',
      'AI': 'Anguilla',
      'BM': 'Bermuda',
      'VG': 'British Virgin Islands',
      'KY': 'Cayman Islands',
      'TC': 'Turks and Caicos Islands',
      'AW': 'Aruba',
      'CW': 'Curaçao',
      'SX': 'Sint Maarten',
      'BQ': 'Caribbean Netherlands',
      'PR': 'Puerto Rico',
      'VI': 'U.S. Virgin Islands',
      'AS': 'American Samoa',
      'GU': 'Guam',
      'MP': 'Northern Mariana Islands'
    };
    return countryNames[countryCode] || countryCode;
  };

  const countries = [
    { code: 'AD', name: 'Andorra' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'AF', name: 'Afghanistan' },
    { code: 'AG', name: 'Antigua and Barbuda' },
    { code: 'AI', name: 'Anguilla' },
    { code: 'AL', name: 'Albania' },
    { code: 'AM', name: 'Armenia' },
    { code: 'AO', name: 'Angola' },
    { code: 'AR', name: 'Argentina' },
    { code: 'AS', name: 'American Samoa' },
    { code: 'AT', name: 'Austria' },
    { code: 'AU', name: 'Australia' },
    { code: 'AW', name: 'Aruba' },
    { code: 'AZ', name: 'Azerbaijan' },
    { code: 'BA', name: 'Bosnia and Herzegovina' },
    { code: 'BB', name: 'Barbados' },
    { code: 'BD', name: 'Bangladesh' },
    { code: 'BE', name: 'Belgium' },
    { code: 'BF', name: 'Burkina Faso' },
    { code: 'BG', name: 'Bulgaria' },
    { code: 'BH', name: 'Bahrain' },
    { code: 'BI', name: 'Burundi' },
    { code: 'BJ', name: 'Benin' },
    { code: 'BL', name: 'Saint Barthélemy' },
    { code: 'BM', name: 'Bermuda' },
    { code: 'BN', name: 'Brunei' },
    { code: 'BO', name: 'Bolivia' },
    { code: 'BQ', name: 'Caribbean Netherlands' },
    { code: 'BR', name: 'Brazil' },
    { code: 'BS', name: 'Bahamas' },
    { code: 'BT', name: 'Bhutan' },
    { code: 'BW', name: 'Botswana' },
    { code: 'BY', name: 'Belarus' },
    { code: 'BZ', name: 'Belize' },
    { code: 'CA', name: 'Canada' },
    { code: 'CD', name: 'Democratic Republic of the Congo' },
    { code: 'CF', name: 'Central African Republic' },
    { code: 'CG', name: 'Republic of the Congo' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'CI', name: 'Côte d\'Ivoire' },
    { code: 'CK', name: 'Cook Islands' },
    { code: 'CL', name: 'Chile' },
    { code: 'CM', name: 'Cameroon' },
    { code: 'CN', name: 'China' },
    { code: 'CO', name: 'Colombia' },
    { code: 'CR', name: 'Costa Rica' },
    { code: 'CU', name: 'Cuba' },
    { code: 'CV', name: 'Cape Verde' },
    { code: 'CW', name: 'Curaçao' },
    { code: 'CY', name: 'Cyprus' },
    { code: 'CZ', name: 'Czech Republic' },
    { code: 'DE', name: 'Germany' },
    { code: 'DJ', name: 'Djibouti' },
    { code: 'DK', name: 'Denmark' },
    { code: 'DM', name: 'Dominica' },
    { code: 'DO', name: 'Dominican Republic' },
    { code: 'DZ', name: 'Algeria' },
    { code: 'EC', name: 'Ecuador' },
    { code: 'EE', name: 'Estonia' },
    { code: 'EG', name: 'Egypt' },
    { code: 'ER', name: 'Eritrea' },
    { code: 'ES', name: 'Spain' },
    { code: 'ET', name: 'Ethiopia' },
    { code: 'FI', name: 'Finland' },
    { code: 'FJ', name: 'Fiji' },
    { code: 'FK', name: 'Falkland Islands' },
    { code: 'FM', name: 'Micronesia' },
    { code: 'FO', name: 'Faroe Islands' },
    { code: 'FR', name: 'France' },
    { code: 'GA', name: 'Gabon' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'GD', name: 'Grenada' },
    { code: 'GE', name: 'Georgia' },
    { code: 'GF', name: 'French Guiana' },
    { code: 'GG', name: 'Guernsey' },
    { code: 'GH', name: 'Ghana' },
    { code: 'GI', name: 'Gibraltar' },
    { code: 'GL', name: 'Greenland' },
    { code: 'GM', name: 'Gambia' },
    { code: 'GN', name: 'Guinea' },
    { code: 'GP', name: 'Guadeloupe' },
    { code: 'GQ', name: 'Equatorial Guinea' },
    { code: 'GR', name: 'Greece' },
    { code: 'GS', name: 'South Georgia and the South Sandwich Islands' },
    { code: 'GT', name: 'Guatemala' },
    { code: 'GU', name: 'Guam' },
    { code: 'GW', name: 'Guinea-Bissau' },
    { code: 'GY', name: 'Guyana' },
    { code: 'HK', name: 'Hong Kong' },
    { code: 'HN', name: 'Honduras' },
    { code: 'HR', name: 'Croatia' },
    { code: 'HT', name: 'Haiti' },
    { code: 'HU', name: 'Hungary' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'IE', name: 'Ireland' },
    { code: 'IL', name: 'Israel' },
    { code: 'IM', name: 'Isle of Man' },
    { code: 'IN', name: 'India' },
    { code: 'IO', name: 'British Indian Ocean Territory' },
    { code: 'IQ', name: 'Iraq' },
    { code: 'IR', name: 'Iran' },
    { code: 'IS', name: 'Iceland' },
    { code: 'IT', name: 'Italy' },
    { code: 'JE', name: 'Jersey' },
    { code: 'JM', name: 'Jamaica' },
    { code: 'JO', name: 'Jordan' },
    { code: 'JP', name: 'Japan' },
    { code: 'KE', name: 'Kenya' },
    { code: 'KG', name: 'Kyrgyzstan' },
    { code: 'KH', name: 'Cambodia' },
    { code: 'KI', name: 'Kiribati' },
    { code: 'KM', name: 'Comoros' },
    { code: 'KN', name: 'Saint Kitts and Nevis' },
    { code: 'KP', name: 'North Korea' },
    { code: 'KR', name: 'South Korea' },
    { code: 'KW', name: 'Kuwait' },
    { code: 'KY', name: 'Cayman Islands' },
    { code: 'KZ', name: 'Kazakhstan' },
    { code: 'LA', name: 'Laos' },
    { code: 'LB', name: 'Lebanon' },
    { code: 'LC', name: 'Saint Lucia' },
    { code: 'LI', name: 'Liechtenstein' },
    { code: 'LK', name: 'Sri Lanka' },
    { code: 'LR', name: 'Liberia' },
    { code: 'LS', name: 'Lesotho' },
    { code: 'LT', name: 'Lithuania' },
    { code: 'LU', name: 'Luxembourg' },
    { code: 'LV', name: 'Latvia' },
    { code: 'LY', name: 'Libya' },
    { code: 'MA', name: 'Morocco' },
    { code: 'MC', name: 'Monaco' },
    { code: 'MD', name: 'Moldova' },
    { code: 'ME', name: 'Montenegro' },
    { code: 'MF', name: 'Saint Martin' },
    { code: 'MG', name: 'Madagascar' },
    { code: 'MH', name: 'Marshall Islands' },
    { code: 'MK', name: 'North Macedonia' },
    { code: 'ML', name: 'Mali' },
    { code: 'MM', name: 'Myanmar' },
    { code: 'MN', name: 'Mongolia' },
    { code: 'MO', name: 'Macao' },
    { code: 'MP', name: 'Northern Mariana Islands' },
    { code: 'MQ', name: 'Martinique' },
    { code: 'MR', name: 'Mauritania' },
    { code: 'MS', name: 'Montserrat' },
    { code: 'MT', name: 'Malta' },
    { code: 'MU', name: 'Mauritius' },
    { code: 'MV', name: 'Maldives' },
    { code: 'MW', name: 'Malawi' },
    { code: 'MX', name: 'Mexico' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'MZ', name: 'Mozambique' },
    { code: 'NA', name: 'Namibia' },
    { code: 'NC', name: 'New Caledonia' },
    { code: 'NE', name: 'Niger' },
    { code: 'NF', name: 'Norfolk Island' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'NI', name: 'Nicaragua' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'NO', name: 'Norway' },
    { code: 'NP', name: 'Nepal' },
    { code: 'NR', name: 'Nauru' },
    { code: 'NU', name: 'Niue' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'OM', name: 'Oman' },
    { code: 'PA', name: 'Panama' },
    { code: 'PE', name: 'Peru' },
    { code: 'PF', name: 'French Polynesia' },
    { code: 'PG', name: 'Papua New Guinea' },
    { code: 'PH', name: 'Philippines' },
    { code: 'PK', name: 'Pakistan' },
    { code: 'PL', name: 'Poland' },
    { code: 'PM', name: 'Saint Pierre and Miquelon' },
    { code: 'PN', name: 'Pitcairn Islands' },
    { code: 'PR', name: 'Puerto Rico' },
    { code: 'PS', name: 'Palestine' },
    { code: 'PT', name: 'Portugal' },
    { code: 'PW', name: 'Palau' },
    { code: 'PY', name: 'Paraguay' },
    { code: 'QA', name: 'Qatar' },
    { code: 'RE', name: 'Réunion' },
    { code: 'RO', name: 'Romania' },
    { code: 'RS', name: 'Serbia' },
    { code: 'RU', name: 'Russia' },
    { code: 'RW', name: 'Rwanda' },
    { code: 'SA', name: 'Saudi Arabia' },
    { code: 'SB', name: 'Solomon Islands' },
    { code: 'SC', name: 'Seychelles' },
    { code: 'SD', name: 'Sudan' },
    { code: 'SE', name: 'Sweden' },
    { code: 'SG', name: 'Singapore' },
    { code: 'SH', name: 'Saint Helena' },
    { code: 'SI', name: 'Slovenia' },
    { code: 'SJ', name: 'Svalbard and Jan Mayen' },
    { code: 'SK', name: 'Slovakia' },
    { code: 'SL', name: 'Sierra Leone' },
    { code: 'SM', name: 'San Marino' },
    { code: 'SN', name: 'Senegal' },
    { code: 'SO', name: 'Somalia' },
    { code: 'SR', name: 'Suriname' },
    { code: 'SS', name: 'South Sudan' },
    { code: 'ST', name: 'São Tomé and Príncipe' },
    { code: 'SV', name: 'El Salvador' },
    { code: 'SX', name: 'Sint Maarten' },
    { code: 'SY', name: 'Syria' },
    { code: 'SZ', name: 'Eswatini' },
    { code: 'TC', name: 'Turks and Caicos Islands' },
    { code: 'TD', name: 'Chad' },
    { code: 'TF', name: 'French Southern Territories' },
    { code: 'TG', name: 'Togo' },
    { code: 'TH', name: 'Thailand' },
    { code: 'TJ', name: 'Tajikistan' },
    { code: 'TK', name: 'Tokelau' },
    { code: 'TL', name: 'Timor-Leste' },
    { code: 'TM', name: 'Turkmenistan' },
    { code: 'TN', name: 'Tunisia' },
    { code: 'TO', name: 'Tonga' },
    { code: 'TR', name: 'Turkey' },
    { code: 'TT', name: 'Trinidad and Tobago' },
    { code: 'TV', name: 'Tuvalu' },
    { code: 'TW', name: 'Taiwan' },
    { code: 'TZ', name: 'Tanzania' },
    { code: 'UA', name: 'Ukraine' },
    { code: 'UG', name: 'Uganda' },
    { code: 'UM', name: 'United States Minor Outlying Islands' },
    { code: 'US', name: 'United States' },
    { code: 'UY', name: 'Uruguay' },
    { code: 'UZ', name: 'Uzbekistan' },
    { code: 'VA', name: 'Vatican City' },
    { code: 'VC', name: 'Saint Vincent and the Grenadines' },
    { code: 'VE', name: 'Venezuela' },
    { code: 'VG', name: 'British Virgin Islands' },
    { code: 'VI', name: 'U.S. Virgin Islands' },
    { code: 'VN', name: 'Vietnam' },
    { code: 'VU', name: 'Vanuatu' },
    { code: 'WF', name: 'Wallis and Futuna' },
    { code: 'WS', name: 'Samoa' },
    { code: 'YE', name: 'Yemen' },
    { code: 'YT', name: 'Mayotte' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'ZM', name: 'Zambia' },
    { code: 'ZW', name: 'Zimbabwe' }
  ].sort((a, b) => a.name.localeCompare(b.name));

  // Códigos de país para teléfonos con banderas y códigos ISO
  const phoneCountryCodes = [
    { code: '+1', flag: '🇺🇸', country: 'United States', iso: 'USA' },
    { code: '+1', flag: '🇨🇦', country: 'Canada', iso: 'CAN' },
    { code: '+7', flag: '🇷🇺', country: 'Russia', iso: 'RUS' },
    { code: '+7', flag: '🇰🇿', country: 'Kazakhstan', iso: 'KAZ' },
    { code: '+20', flag: '🇪🇬', country: 'Egypt', iso: 'EGY' },
    { code: '+27', flag: '🇿🇦', country: 'South Africa', iso: 'ZAF' },
    { code: '+30', flag: '🇬🇷', country: 'Greece', iso: 'GRC' },
    { code: '+31', flag: '🇳🇱', country: 'Netherlands', iso: 'NLD' },
    { code: '+32', flag: '🇧🇪', country: 'Belgium', iso: 'BEL' },
    { code: '+33', flag: '🇫🇷', country: 'France', iso: 'FRA' },
    { code: '+34', flag: '🇪🇸', country: 'Spain', iso: 'ESP' },
    { code: '+36', flag: '🇭🇺', country: 'Hungary', iso: 'HUN' },
    { code: '+39', flag: '🇮🇹', country: 'Italy', iso: 'ITA' },
    { code: '+40', flag: '🇷🇴', country: 'Romania', iso: 'ROU' },
    { code: '+41', flag: '🇨🇭', country: 'Switzerland', iso: 'CHE' },
    { code: '+43', flag: '🇦🇹', country: 'Austria', iso: 'AUT' },
    { code: '+44', flag: '🇬🇧', country: 'United Kingdom', iso: 'GBR' },
    { code: '+45', flag: '🇩🇰', country: 'Denmark', iso: 'DNK' },
    { code: '+46', flag: '🇸🇪', country: 'Sweden', iso: 'SWE' },
    { code: '+47', flag: '🇳🇴', country: 'Norway', iso: 'NOR' },
    { code: '+48', flag: '🇵🇱', country: 'Poland', iso: 'POL' },
    { code: '+49', flag: '🇩🇪', country: 'Germany', iso: 'DEU' },
    { code: '+51', flag: '🇵🇪', country: 'Peru', iso: 'PER' },
    { code: '+52', flag: '🇲🇽', country: 'Mexico', iso: 'MEX' },
    { code: '+53', flag: '🇨🇺', country: 'Cuba', iso: 'CUB' },
    { code: '+54', flag: '🇦🇷', country: 'Argentina', iso: 'ARG' },
    { code: '+55', flag: '🇧🇷', country: 'Brazil', iso: 'BRA' },
    { code: '+56', flag: '🇨🇱', country: 'Chile', iso: 'CHL' },
    { code: '+57', flag: '🇨🇴', country: 'Colombia', iso: 'COL' },
    { code: '+58', flag: '🇻🇪', country: 'Venezuela', iso: 'VEN' },
    { code: '+60', flag: '🇲🇾', country: 'Malaysia', iso: 'MYS' },
    { code: '+61', flag: '🇦🇺', country: 'Australia', iso: 'AUS' },
    { code: '+62', flag: '🇮🇩', country: 'Indonesia', iso: 'IDN' },
    { code: '+63', flag: '🇵🇭', country: 'Philippines', iso: 'PHL' },
    { code: '+64', flag: '🇳🇿', country: 'New Zealand', iso: 'NZL' },
    { code: '+65', flag: '🇸🇬', country: 'Singapore', iso: 'SGP' },
    { code: '+66', flag: '🇹🇭', country: 'Thailand', iso: 'THA' },
    { code: '+81', flag: '🇯🇵', country: 'Japan', iso: 'JPN' },
    { code: '+82', flag: '🇰🇷', country: 'South Korea', iso: 'KOR' },
    { code: '+84', flag: '🇻🇳', country: 'Vietnam', iso: 'VNM' },
    { code: '+86', flag: '🇨🇳', country: 'China', iso: 'CHN' },
    { code: '+90', flag: '🇹🇷', country: 'Turkey', iso: 'TUR' },
    { code: '+91', flag: '🇮🇳', country: 'India', iso: 'IND' },
    { code: '+92', flag: '🇵🇰', country: 'Pakistan', iso: 'PAK' },
    { code: '+93', flag: '🇦🇫', country: 'Afghanistan', iso: 'AFG' },
    { code: '+94', flag: '🇱🇰', country: 'Sri Lanka', iso: 'LKA' },
    { code: '+95', flag: '🇲🇲', country: 'Myanmar', iso: 'MMR' },
    { code: '+98', flag: '🇮🇷', country: 'Iran', iso: 'IRN' },
    { code: '+212', flag: '🇲🇦', country: 'Morocco', iso: 'MAR' },
    { code: '+213', flag: '🇩🇿', country: 'Algeria', iso: 'DZA' },
    { code: '+216', flag: '🇹🇳', country: 'Tunisia', iso: 'TUN' },
    { code: '+218', flag: '🇱🇾', country: 'Libya', iso: 'LBY' },
    { code: '+220', flag: '🇬🇲', country: 'Gambia', iso: 'GMB' },
    { code: '+221', flag: '🇸🇳', country: 'Senegal', iso: 'SEN' },
    { code: '+222', flag: '🇲🇷', country: 'Mauritania', iso: 'MRT' },
    { code: '+223', flag: '🇲🇱', country: 'Mali', iso: 'MLI' },
    { code: '+224', flag: '🇬🇳', country: 'Guinea', iso: 'GIN' },
    { code: '+225', flag: '🇨🇮', country: 'Côte d\'Ivoire', iso: 'CIV' },
    { code: '+226', flag: '🇧🇫', country: 'Burkina Faso', iso: 'BFA' },
    { code: '+227', flag: '🇳🇪', country: 'Niger', iso: 'NER' },
    { code: '+228', flag: '🇹🇬', country: 'Togo', iso: 'TGO' },
    { code: '+229', flag: '🇧🇯', country: 'Benin', iso: 'BEN' },
    { code: '+230', flag: '🇲🇺', country: 'Mauritius', iso: 'MUS' },
    { code: '+231', flag: '🇱🇷', country: 'Liberia', iso: 'LBR' },
    { code: '+232', flag: '🇸🇱', country: 'Sierra Leone', iso: 'SLE' },
    { code: '+233', flag: '🇬🇭', country: 'Ghana', iso: 'GHA' },
    { code: '+234', flag: '🇳🇬', country: 'Nigeria', iso: 'NGA' },
    { code: '+235', flag: '🇹🇩', country: 'Chad', iso: 'TCD' },
    { code: '+236', flag: '🇨🇫', country: 'Central African Republic', iso: 'CAF' },
    { code: '+237', flag: '🇨🇲', country: 'Cameroon', iso: 'CMR' },
    { code: '+238', flag: '🇨🇻', country: 'Cape Verde', iso: 'CPV' },
    { code: '+239', flag: '🇸🇹', country: 'São Tomé and Príncipe', iso: 'STP' },
    { code: '+240', flag: '🇬🇶', country: 'Equatorial Guinea', iso: 'GNQ' },
    { code: '+241', flag: '🇬🇦', country: 'Gabon', iso: 'GAB' },
    { code: '+242', flag: '🇨🇬', country: 'Republic of the Congo', iso: 'COG' },
    { code: '+243', flag: '🇨🇩', country: 'Democratic Republic of the Congo', iso: 'COD' },
    { code: '+244', flag: '🇦🇴', country: 'Angola', iso: 'AGO' },
    { code: '+245', flag: '🇬🇼', country: 'Guinea-Bissau', iso: 'GNB' },
    { code: '+246', flag: '🇮🇴', country: 'British Indian Ocean Territory', iso: 'IOT' },
    { code: '+248', flag: '🇸🇨', country: 'Seychelles', iso: 'SYC' },
    { code: '+249', flag: '🇸🇩', country: 'Sudan', iso: 'SDN' },
    { code: '+250', flag: '🇷🇼', country: 'Rwanda', iso: 'RWA' },
    { code: '+251', flag: '🇪🇹', country: 'Ethiopia', iso: 'ETH' },
    { code: '+252', flag: '🇸🇴', country: 'Somalia', iso: 'SOM' },
    { code: '+253', flag: '🇩🇯', country: 'Djibouti', iso: 'DJI' },
    { code: '+254', flag: '🇰🇪', country: 'Kenya', iso: 'KEN' },
    { code: '+255', flag: '🇹🇿', country: 'Tanzania', iso: 'TZA' },
    { code: '+256', flag: '🇺🇬', country: 'Uganda', iso: 'UGA' },
    { code: '+257', flag: '🇧🇮', country: 'Burundi', iso: 'BDI' },
    { code: '+258', flag: '🇲🇿', country: 'Mozambique', iso: 'MOZ' },
    { code: '+260', flag: '🇿🇲', country: 'Zambia', iso: 'ZMB' },
    { code: '+261', flag: '🇲🇬', country: 'Madagascar', iso: 'MDG' },
    { code: '+262', flag: '🇷🇪', country: 'Réunion', iso: 'REU' },
    { code: '+263', flag: '🇿🇼', country: 'Zimbabwe', iso: 'ZWE' },
    { code: '+264', flag: '🇳🇦', country: 'Namibia', iso: 'NAM' },
    { code: '+265', flag: '🇲🇼', country: 'Malawi', iso: 'MWI' },
    { code: '+266', flag: '🇱🇸', country: 'Lesotho', iso: 'LSO' },
    { code: '+267', flag: '🇧🇼', country: 'Botswana', iso: 'BWA' },
    { code: '+268', flag: '🇸🇿', country: 'Eswatini', iso: 'SWZ' },
    { code: '+269', flag: '🇰🇲', country: 'Comoros', iso: 'COM' },
    { code: '+290', flag: '🇸🇭', country: 'Saint Helena', iso: 'SHN' },
    { code: '+291', flag: '🇪🇷', country: 'Eritrea', iso: 'ERI' },
    { code: '+297', flag: '🇦🇼', country: 'Aruba', iso: 'ABW' },
    { code: '+298', flag: '🇫🇴', country: 'Faroe Islands', iso: 'FRO' },
    { code: '+299', flag: '🇬🇱', country: 'Greenland', iso: 'GRL' },
    { code: '+350', flag: '🇬🇮', country: 'Gibraltar', iso: 'GIB' },
    { code: '+351', flag: '🇵🇹', country: 'Portugal', iso: 'PRT' },
    { code: '+352', flag: '🇱🇺', country: 'Luxembourg', iso: 'LUX' },
    { code: '+353', flag: '🇮🇪', country: 'Ireland', iso: 'IRL' },
    { code: '+354', flag: '🇮🇸', country: 'Iceland', iso: 'ISL' },
    { code: '+355', flag: '🇦🇱', country: 'Albania', iso: 'ALB' },
    { code: '+356', flag: '🇲🇹', country: 'Malta', iso: 'MLT' },
    { code: '+357', flag: '🇨🇾', country: 'Cyprus', iso: 'CYP' },
    { code: '+358', flag: '🇫🇮', country: 'Finland', iso: 'FIN' },
    { code: '+359', flag: '🇧🇬', country: 'Bulgaria', iso: 'BGR' },
    { code: '+370', flag: '🇱🇹', country: 'Lithuania', iso: 'LTU' },
    { code: '+371', flag: '🇱🇻', country: 'Latvia', iso: 'LVA' },
    { code: '+372', flag: '🇪🇪', country: 'Estonia', iso: 'EST' },
    { code: '+373', flag: '🇲🇩', country: 'Moldova', iso: 'MDA' },
    { code: '+374', flag: '🇦🇲', country: 'Armenia', iso: 'ARM' },
    { code: '+375', flag: '🇧🇾', country: 'Belarus', iso: 'BLR' },
    { code: '+376', flag: '🇦🇩', country: 'Andorra', iso: 'AND' },
    { code: '+377', flag: '🇲🇨', country: 'Monaco', iso: 'MCO' },
    { code: '+378', flag: '🇸🇲', country: 'San Marino', iso: 'SMR' },
    { code: '+380', flag: '🇺🇦', country: 'Ukraine', iso: 'UKR' },
    { code: '+381', flag: '🇷🇸', country: 'Serbia', iso: 'SRB' },
    { code: '+382', flag: '🇲🇪', country: 'Montenegro', iso: 'MNE' },
    { code: '+383', flag: '🇽🇰', country: 'Kosovo', iso: 'XKX' },
    { code: '+385', flag: '🇭🇷', country: 'Croatia', iso: 'HRV' },
    { code: '+386', flag: '🇸🇮', country: 'Slovenia', iso: 'SVN' },
    { code: '+387', flag: '🇧🇦', country: 'Bosnia and Herzegovina', iso: 'BIH' },
    { code: '+389', flag: '🇲🇰', country: 'North Macedonia', iso: 'MKD' },
    { code: '+420', flag: '🇨🇿', country: 'Czech Republic', iso: 'CZE' },
    { code: '+421', flag: '🇸🇰', country: 'Slovakia', iso: 'SVK' },
    { code: '+423', flag: '🇱🇮', country: 'Liechtenstein', iso: 'LIE' },
    { code: '+500', flag: '🇫🇰', country: 'Falkland Islands', iso: 'FLK' },
    { code: '+501', flag: '🇧🇿', country: 'Belize', iso: 'BLZ' },
    { code: '+502', flag: '🇬🇹', country: 'Guatemala', iso: 'GTM' },
    { code: '+503', flag: '🇸🇻', country: 'El Salvador', iso: 'SLV' },
    { code: '+504', flag: '🇭🇳', country: 'Honduras', iso: 'HND' },
    { code: '+505', flag: '🇳🇮', country: 'Nicaragua', iso: 'NIC' },
    { code: '+506', flag: '🇨🇷', country: 'Costa Rica', iso: 'CRI' },
    { code: '+507', flag: '🇵🇦', country: 'Panama', iso: 'PAN' },
    { code: '+508', flag: '🇵🇲', country: 'Saint Pierre and Miquelon', iso: 'SPM' },
    { code: '+509', flag: '🇭🇹', country: 'Haiti', iso: 'HTI' },
    { code: '+590', flag: '🇬🇵', country: 'Guadeloupe', iso: 'GLP' },
    { code: '+591', flag: '🇧🇴', country: 'Bolivia', iso: 'BOL' },
    { code: '+592', flag: '🇬🇾', country: 'Guyana', iso: 'GUY' },
    { code: '+593', flag: '🇪🇨', country: 'Ecuador', iso: 'ECU' },
    { code: '+594', flag: '🇬🇫', country: 'French Guiana', iso: 'GUF' },
    { code: '+595', flag: '🇵🇾', country: 'Paraguay', iso: 'PRY' },
    { code: '+596', flag: '🇲🇶', country: 'Martinique', iso: 'MTQ' },
    { code: '+597', flag: '🇸🇷', country: 'Suriname', iso: 'SUR' },
    { code: '+598', flag: '🇺🇾', country: 'Uruguay', iso: 'URY' },
    { code: '+599', flag: '🇨🇼', country: 'Curaçao', iso: 'CUW' },
    { code: '+670', flag: '🇹🇱', country: 'Timor-Leste', iso: 'TLS' },
    { code: '+672', flag: '🇦🇶', country: 'Antarctica', iso: 'ATA' },
    { code: '+673', flag: '🇧🇳', country: 'Brunei', iso: 'BRN' },
    { code: '+674', flag: '🇳🇷', country: 'Nauru', iso: 'NRU' },
    { code: '+675', flag: '🇵🇬', country: 'Papua New Guinea', iso: 'PNG' },
    { code: '+676', flag: '🇹🇴', country: 'Tonga', iso: 'TON' },
    { code: '+677', flag: '🇸🇧', country: 'Solomon Islands', iso: 'SLB' },
    { code: '+678', flag: '🇻🇺', country: 'Vanuatu', iso: 'VUT' },
    { code: '+679', flag: '🇫🇯', country: 'Fiji', iso: 'FJI' },
    { code: '+680', flag: '🇵🇼', country: 'Palau', iso: 'PLW' },
    { code: '+681', flag: '🇼🇫', country: 'Wallis and Futuna', iso: 'WLF' },
    { code: '+682', flag: '🇨🇰', country: 'Cook Islands', iso: 'COK' },
    { code: '+683', flag: '🇳🇺', country: 'Niue', iso: 'NIU' },
    { code: '+684', flag: '🇦🇸', country: 'American Samoa', iso: 'ASM' },
    { code: '+685', flag: '🇼🇸', country: 'Samoa', iso: 'WSM' },
    { code: '+686', flag: '🇰🇮', country: 'Kiribati', iso: 'KIR' },
    { code: '+687', flag: '🇳🇨', country: 'New Caledonia', iso: 'NCL' },
    { code: '+688', flag: '🇹🇻', country: 'Tuvalu', iso: 'TUV' },
    { code: '+689', flag: '🇵🇫', country: 'French Polynesia', iso: 'PYF' },
    { code: '+690', flag: '🇹🇰', country: 'Tokelau', iso: 'TKL' },
    { code: '+691', flag: '🇫🇲', country: 'Micronesia', iso: 'FSM' },
    { code: '+692', flag: '🇲🇭', country: 'Marshall Islands', iso: 'MHL' },
    { code: '+850', flag: '🇰🇵', country: 'North Korea', iso: 'PRK' },
    { code: '+852', flag: '🇭🇰', country: 'Hong Kong', iso: 'HKG' },
    { code: '+853', flag: '🇲🇴', country: 'Macao', iso: 'MAC' },
    { code: '+855', flag: '🇰🇭', country: 'Cambodia', iso: 'KHM' },
    { code: '+856', flag: '🇱🇦', country: 'Laos', iso: 'LAO' },
    { code: '+880', flag: '🇧🇩', country: 'Bangladesh', iso: 'BGD' },
    { code: '+886', flag: '🇹🇼', country: 'Taiwan', iso: 'TWN' },
    { code: '+960', flag: '🇲🇻', country: 'Maldives', iso: 'MDV' },
    { code: '+961', flag: '🇱🇧', country: 'Lebanon', iso: 'LBN' },
    { code: '+962', flag: '🇯🇴', country: 'Jordan', iso: 'JOR' },
    { code: '+963', flag: '🇸🇾', country: 'Syria', iso: 'SYR' },
    { code: '+964', flag: '🇮🇶', country: 'Iraq', iso: 'IRQ' },
    { code: '+965', flag: '🇰🇼', country: 'Kuwait', iso: 'KWT' },
    { code: '+966', flag: '🇸🇦', country: 'Saudi Arabia', iso: 'SAU' },
    { code: '+967', flag: '🇾🇪', country: 'Yemen', iso: 'YEM' },
    { code: '+968', flag: '🇴🇲', country: 'Oman', iso: 'OMN' },
    { code: '+970', flag: '🇵🇸', country: 'Palestine', iso: 'PSE' },
    { code: '+971', flag: '🇦🇪', country: 'United Arab Emirates', iso: 'ARE' },
    { code: '+972', flag: '🇮🇱', country: 'Israel', iso: 'ISR' },
    { code: '+973', flag: '🇧🇭', country: 'Bahrain', iso: 'BHR' },
    { code: '+974', flag: '🇶🇦', country: 'Qatar', iso: 'QAT' },
    { code: '+975', flag: '🇧🇹', country: 'Bhutan', iso: 'BTN' },
    { code: '+976', flag: '🇲🇳', country: 'Mongolia', iso: 'MNG' },
    { code: '+977', flag: '🇳🇵', country: 'Nepal', iso: 'NPL' },
    { code: '+992', flag: '🇹🇯', country: 'Tajikistan', iso: 'TJK' },
    { code: '+993', flag: '🇹🇲', country: 'Turkmenistan', iso: 'TKM' },
    { code: '+994', flag: '🇦🇿', country: 'Azerbaijan', iso: 'AZE' },
    { code: '+995', flag: '🇬🇪', country: 'Georgia', iso: 'GEO' },
    { code: '+996', flag: '🇰🇬', country: 'Kyrgyzstan', iso: 'KGZ' },
    { code: '+998', flag: '🇺🇿', country: 'Uzbekistan', iso: 'UZB' }
  ].sort((a, b) => a.iso.localeCompare(b.iso));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Función para manejar el documento de Tax ID
  const handleTaxIdDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo (PDF, JPG, PNG)
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        setErrors(prev => ({ 
          ...prev, 
          taxIdDocument: 'Please upload a PDF, JPG, or PNG file' 
        }));
        return;
      }
      
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ 
          ...prev, 
          taxIdDocument: 'File size must be less than 5MB' 
        }));
        return;
      }
      
      setTaxIdDocument(file);
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.taxIdDocument;
        return newErrors;
      });
    }
  };

  const removeTaxIdDocument = () => {
    setTaxIdDocument(null);
  };

  // Función para verificar si el email existe
  const checkEmailExists = (email: string) => {
    setIsCheckingEmail(true);
    
    // TEMPORAL: Simulación inmediata para testing
    // En producción, esto debería ser una llamada a la API
    setTimeout(() => {
      if (email.includes('@test.com') || email.includes('@existing.com') || email.includes('@gmail.com')) {
        setUserMode('existing_user');
        setExistingUserId('test-user-123');
      } else {
        setUserMode('new_user');
        setExistingUserId(null);
      }
      setIsCheckingEmail(false);
    }, 100); // Simular un pequeño delay
  };

  // Función para manejar el OTP con 6 inputs separados
  const handleOtpChange = (index: number, value: string) => {
    // Solo permitir números
    const numericValue = value.replace(/\D/g, '');
    
    if (numericValue.length <= 1) {
      const newOtp = [...otpCode];
      newOtp[index] = numericValue;
      setOtpCode(newOtp);
      
      // Auto-focus al siguiente input si se ingresó un dígito
      if (numericValue && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Backspace: ir al input anterior si el actual está vacío
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
    
    // Paste: manejar pegado de código completo
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const pastedCode = text.replace(/\D/g, '').slice(0, 6);
        if (pastedCode.length === 6) {
          const newOtp = pastedCode.split('');
          setOtpCode(newOtp);
          // Focus al último input
          const lastInput = document.getElementById(`otp-5`);
          lastInput?.focus();
        }
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    // Business registration number is now optional

    if (!formData.country) {
      newErrors.country = 'Country is required';
    }

    if (!formData.corporateEmail.trim()) {
      newErrors.corporateEmail = 'Corporate email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.corporateEmail)) {
      newErrors.corporateEmail = 'Please enter a valid email address';
    } else if (/@(gmail|yahoo|hotmail|outlook)\.com$/i.test(formData.corporateEmail)) {
      newErrors.corporateEmail = 'Please use a corporate email address (not Gmail, Yahoo, etc.)';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^\+?[\d\s\-\(\)]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (uploadedFiles.length === 0) {
      newErrors.documents = 'Please upload at least one document';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 2000);
  };

  const handleGoBack = () => {
    if (cameFromLogin) {
      window.location.href = '/login';
    } else {
      window.history.back();
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      // Verificar email cuando se complete el Step 2 (Contact Details)
      if (currentStep === 2 && formData.contactEmail) {
        checkEmailExists(formData.contactEmail);
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateCurrentStep = () => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 1: // Company Information
        if (!formData.companyName.trim()) newErrors.companyName = 'Company name is required';
        if (!formData.country) newErrors.country = 'Country is required';
        if (!formData.industry) newErrors.industry = 'Industry is required';
        if (!formData.companySize) newErrors.companySize = 'Company size is required';
        break;
          case 2: // Contact Details
            if (!formData.contactFirstName.trim()) newErrors.contactFirstName = 'First name is required';
            if (!formData.contactLastName.trim()) newErrors.contactLastName = 'Last name is required';
            if (!formData.contactEmail.trim()) {
              newErrors.contactEmail = 'Contact email is required';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) {
              newErrors.contactEmail = 'Please enter a valid email address';
            } else {
              const emailValidation = validateEmailDomain(formData.contactEmail);
              if (!emailValidation.isValid) {
                newErrors.contactEmail = emailValidation.error;
              }
            }
            // Phone number is optional, but validate if provided
            if (formData.phoneNumber.trim()) {
              const phoneValidation = validatePhoneNumber(formData.phoneNumber, formData.phoneCountryCode);
              if (!phoneValidation.isValid) {
                newErrors.phoneNumber = phoneValidation.error;
              }
            }
            break;
      case 3: // Email Verification
        const otpString = otpCode.join('');
        if (!otpString) {
          newErrors.otpCode = 'Verification code is required';
        } else if (!/^\d{6}$/.test(otpString)) {
          newErrors.otpCode = 'Please enter a valid 6-digit code';
        }
        break;
      case 4: // Security
        // Solo validar contraseña para usuarios nuevos
        if (userMode === 'new_user') {
          if (!formData.password) {
            newErrors.password = 'Password is required';
          } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters long';
          }
          if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
          } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
          }
        }
        // Para usuarios existentes, no se requiere validación de contraseña
        break;
      case 5: // Additional Information
        // All fields are optional, no validation needed
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStepNext = () => {
    if (validateCurrentStep()) {
      if (currentStep === totalSteps) {
        handleSubmit({ preventDefault: () => {} } as React.FormEvent);
      } else {
        handleNext();
      }
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  <Box size={24} style={{ color: 'var(--primary-brand-hex)' }} />
                  <span className="text-lg font-semibold text-gray-900">WAPunch</span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">Account created successfully</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-82">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-green-500/20 backdrop-blur-sm rounded-2xl mx-auto mb-6 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Company Account Created!</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Your company account has been successfully created and is pending verification.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-8">
              {/* Next Steps */}
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">What happens next?</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-6 bg-green-50 rounded-lg">
                    <div className="w-12 h-12 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Verification Required</h3>
                    <p className="text-sm text-gray-600">
                      We'll review your documents and verify your company information within 24-48 hours.
                    </p>
                  </div>
                  
                  <div className="text-center p-6 bg-blue-50 rounded-lg">
                    <div className="w-12 h-12 bg-blue-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Confirmation</h3>
                    <p className="text-sm text-gray-600">
                      Check your email for verification instructions and next steps.
                    </p>
                  </div>
                  
                  <div className="text-center p-6 bg-purple-50 rounded-lg">
                    <div className="w-12 h-12 bg-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Your Portal</h3>
                    <p className="text-sm text-gray-600">
                      Once verified, you'll receive login credentials to access your company portal.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleGoBack}
                  className="w-full flex items-center justify-center gap-2 px-4 h-8 rounded text-white transition-colors text-sm"
                  style={{ backgroundColor: 'var(--primary-brand-hex)' }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  {cameFromLogin ? 'Back to Login' : 'Go Back'}
                </button>
              </div>

              {/* Help Text */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Mail className="w-4 h-4" />
                  <span className="font-medium">Need help?</span>
                </div>
                <p className="text-xs text-gray-500">
                  Contact our support team if you have any questions about the verification process.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 ${
                      errors.companyName 
                        ? 'border-red-300 focus:ring-red-500' 
                        : ''
                    }`}
                    placeholder="Enter your company name"
                    required
                  />
                </div>
                {errors.companyName && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.companyName}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                  Country *
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 appearance-none ${
                      errors.country 
                        ? 'border-red-300 focus:ring-red-500' 
                        : ''
                    }`}
                    required
                  >
                    <option value="">Select your country</option>
                    {countries.map(country => (
                      <option key={country.code} value={country.code}>{country.name}</option>
                    ))}
                  </select>
                </div>
                {errors.country && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.country}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="companySize" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Size *
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    id="companySize"
                    name="companySize"
                    value={formData.companySize}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 appearance-none ${
                      errors.companySize 
                        ? 'border-red-300 focus:ring-red-500' 
                        : ''
                    }`}
                    required
                  >
                    <option value="">Select company size</option>
                    {companySizeOptions.map(size => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.companySize && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.companySize}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-2">
                  Industry *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    id="industry"
                    name="industry"
                    value={formData.industry}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 appearance-none ${
                      errors.industry 
                        ? 'border-red-300 focus:ring-red-500' 
                        : ''
                    }`}
                    required
                  >
                    <option value="">Select your industry</option>
                    {industryOptions.map(industry => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.industry && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.industry}
                  </p>
                )}
              </div>

          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contactFirstName" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="contactFirstName"
                      name="contactFirstName"
                      type="text"
                      value={formData.contactFirstName}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 ${
                        errors.contactFirstName 
                          ? 'border-red-300 focus:ring-red-500' 
                          : ''
                      }`}
                      placeholder="Enter first name"
                      required
                    />
                  </div>
                  {errors.contactFirstName && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.contactFirstName}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="contactLastName" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="contactLastName"
                      name="contactLastName"
                      type="text"
                      value={formData.contactLastName}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 ${
                        errors.contactLastName 
                          ? 'border-red-300 focus:ring-red-500' 
                          : ''
                      }`}
                      placeholder="Enter last name"
                      required
                    />
                  </div>
                  {errors.contactLastName && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.contactLastName}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 ${
                      errors.contactEmail 
                        ? 'border-red-300 focus:ring-red-500' 
                        : ''
                    }`}
                    placeholder="Enter contact email address"
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  This will be the super admin account for your company
                </p>
                {errors.contactEmail && (
                  <p className="mt-1 text-xs text-red-600 flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {errors.contactEmail}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="phoneCountryCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  <div className="relative w-32">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      id="phoneCountryCode"
                      name="phoneCountryCode"
                      value={formData.phoneCountryCode}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 appearance-none ${
                        formData.phoneCountryCode ? 'text-transparent' : ''
                      }`}
                    >
                      <option value="">Area Code</option>
                      {phoneCountryCodes.map((country, index) => (
                        <option key={`${country.code}-${country.iso}-${index}`} value={country.code}>
                          {country.iso} {country.flag} {country.code}
                        </option>
                      ))}
                    </select>
                    {formData.phoneCountryCode && (
                      <div className="absolute inset-y-0 left-0 right-0 flex items-center pl-10 pointer-events-none">
                        <span className="text-sm">
                          {getSelectedCountry(formData.phoneCountryCode)?.flag} {formData.phoneCountryCode}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      className={`w-full px-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 ${
                        errors.phoneNumber 
                          ? 'border-red-300 focus:ring-red-500' 
                          : ''
                      }`}
                      placeholder={(() => {
                        const phoneInfo = getPhoneInfo(formData.phoneCountryCode);
                        return phoneInfo.example_national || 'Enter phone number';
                      })()}
                    />
                  </div>
                </div>
                {errors.phoneNumber && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.phoneNumber}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Website
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="website"
                    name="website"
                    type="url"
                    value={formData.website}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                    placeholder="https://www.yourcompany.com"
                  />
                </div>
              </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h3>
              <p className="text-sm text-gray-600">
                We've sent a 6-digit verification code to <strong>{formData.corporateEmail}</strong>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code *
              </label>
              <div className="flex gap-3 justify-center">
                {otpCode.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className={`w-12 h-12 text-center text-xl font-semibold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${
                      errors.otpCode 
                        ? 'border-red-300 focus:ring-red-500' 
                        : digit 
                          ? 'border-green-400 bg-green-50' 
                          : 'border-gray-300 focus:border-primary'
                    }`}
                    maxLength={1}
                    required
                  />
                ))}
              </div>
              {errors.otpCode && (
                <p className="mt-2 text-xs text-red-600 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.otpCode}
                </p>
              )}
            </div>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
                onClick={() => {
                  // Resend OTP logic
                  console.log('Resend OTP');
                }}
              >
                Didn't receive the code? Resend
              </button>
            </div>
          </div>
        );

      case 4:
        // Mostrar contenido diferente basado en el modo de usuario
        if (userMode === 'existing_user') {
          return (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Account Found</h3>
                <p className="text-sm text-gray-600 mb-4">
                  We found an existing account with <strong>{formData.corporateEmail}</strong>
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>You'll use your existing credentials.</strong><br />
                    No need to create a new password.
                  </p>
                </div>
              </div>
            </div>
          );
        }

        // Para usuarios nuevos, mostrar formulario de contraseña
        const passwordRequirements = [
          { text: 'At least 8 characters', met: formData.password.length >= 8 },
          { text: 'One uppercase letter', met: /[A-Z]/.test(formData.password) },
          { text: 'One lowercase letter', met: /[a-z]/.test(formData.password) },
          { text: 'One number', met: /\d/.test(formData.password) },
          { text: 'One special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) },
        ];

        return (
          <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-10 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 ${
                      errors.password 
                        ? 'border-red-300 focus:ring-red-500' 
                        : ''
                    }`}
                    placeholder="Enter your new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-10 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 ${
                      errors.confirmPassword 
                        ? 'border-red-300 focus:ring-red-500' 
                        : ''
                    }`}
                    placeholder="Confirm your new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Password Requirements */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Password Requirements:</p>
                <div className="space-y-1">
                  {passwordRequirements.map((req, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        req.met ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        {req.met ? (
                          <CheckCircle className="w-3 h-3 text-green-600" />
                        ) : (
                          <div className="w-2 h-2 bg-gray-400 rounded-full" />
                        )}
                      </div>
                      <span className={req.met ? 'text-green-600' : 'text-gray-500'}>
                        {req.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
          </div>
        );

      case 5:
        const taxIdInfo = getTaxIdInfo(formData.country);
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="businessRegistrationNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Business Registration Number / Tax ID {formData.country ? `(${taxIdInfo.tax_id_name})` : ''}
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="businessRegistrationNumber"
                  name="businessRegistrationNumber"
                  type="text"
                  value={formData.businessRegistrationNumber}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                  placeholder={formData.country ? `Enter ${taxIdInfo.tax_id_name} (e.g., ${taxIdInfo.example})` : 'Enter registration number or tax ID'}
                />
              </div>
            </div>

            {/* Upload Business Registration Document */}
            <div>
              <label htmlFor="taxIdDocument" className="block text-sm font-medium text-gray-700 mb-2">
                Upload Business Registration Document
              </label>
              
              {!taxIdDocument ? (
                <div className="relative">
                  <input
                    id="taxIdDocument"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleTaxIdDocumentUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="taxIdDocument"
                    className="flex items-center justify-center gap-2 w-full px-3 py-6 border-2 border-dashed rounded text-sm cursor-pointer transition-colors border-gray-300 bg-gray-50 hover:bg-gray-100"
                  >
                    <Upload className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      Click to upload or drag and drop
                    </span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    PDF, JPG, or PNG (max 5MB)
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-300 rounded">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">
                      {taxIdDocument.name}
                    </span>
                    <span className="text-xs text-gray-500 flex-shrink-0">
                      ({(taxIdDocument.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={removeTaxIdDocument}
                    className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>


            <div>
              <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-2">
                Referral Code
              </label>
              <input
                id="referralCode"
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="w-full px-3 h-8 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50"
                placeholder="Enter referral code (optional)"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        {/* Top Section with consistent padding */}
        <div className="flex-1 flex flex-col p-8 lg:p-12">
          <div className="w-full max-w-lg mx-auto flex flex-col h-full">
            {/* Fixed Header Section */}
            <div className="flex-shrink-0">
              {/* Step Title Section */}
              <div className="mb-10 min-h-[88px] flex flex-col justify-start">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {currentStep === 1 && 'Company Information'}
                  {currentStep === 2 && 'Contact Details'}
                  {currentStep === 3 && 'Email Verification'}
                  {currentStep === 4 && 'Security'}
                  {currentStep === 5 && 'Additional Information'}
                </h1>
                <p className="text-sm text-gray-600">
                  {currentStep === 1 && 'Tell us about your company'}
                  {currentStep === 2 && 'Create your user account and provide contact information'}
                  {currentStep === 3 && 'Verify your email address with the code we sent'}
                  {currentStep === 4 && 'Create a secure password for your account'}
                  {currentStep === 5 && 'Help us understand your business better'}
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-700">Step {currentStep} of {totalSteps}</span>
                  <span className="text-xs text-gray-500">{Math.round((currentStep / totalSteps) * 100)}% complete</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${(currentStep / totalSteps) * 100}%`,
                      backgroundColor: 'var(--primary-brand-hex)'
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto mb-8">
              {getStepContent()}
            </div>

            {/* Fixed Navigation Footer */}
            <div className="flex-shrink-0">
              <div className="flex items-center justify-between gap-3">
              {currentStep === 1 ? (
                <button
                  onClick={handleGoBack}
                  className="flex items-center gap-2 px-4 h-8 rounded text-sm transition-colors text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {cameFromLogin ? 'Back to Login' : 'Go Back'}
                </button>
              ) : (
                <button
                  onClick={handlePrevious}
                  className="flex items-center gap-2 px-4 h-8 rounded text-sm transition-colors text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Previous
                </button>
              )}

              <button
                onClick={handleStepNext}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 h-8 rounded text-white transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--primary-brand-hex)' }}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {currentStep === totalSteps ? 'Create Account' : 'Continue'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Branding & Information */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12" style={{ backgroundColor: 'var(--gray-250)' }}>
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Box size={32} style={{ color: 'var(--primary-brand-hex)' }} />
              <span className="text-2xl font-semibold text-gray-900">WAPunch</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Company Registration</h2>
            <p className="text-sm text-gray-600">Create your company portal to manage your workforce</p>
          </div>

          {/* Step Information Card */}
          <div className="bg-white rounded-xl p-8 shadow-sm mb-8">
            {/* Progress Steps */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  currentStep > 1 ? 'bg-green-100 text-green-700' : currentStep === 1 ? 'text-white' : 'bg-gray-100 text-gray-400'
                }`} style={currentStep === 1 ? { backgroundColor: 'var(--primary-brand-hex)' } : {}}>
                  {currentStep > 1 ? '✓' : '1'}
                </div>
                <span className={`text-sm ${currentStep >= 1 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  Company Information
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  currentStep > 2 ? 'bg-green-100 text-green-700' : currentStep === 2 ? 'text-white' : 'bg-gray-100 text-gray-400'
                }`} style={currentStep === 2 ? { backgroundColor: 'var(--primary-brand-hex)' } : {}}>
                  {currentStep > 2 ? '✓' : '2'}
                </div>
                <span className={`text-sm ${currentStep >= 2 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  Contact Details
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  currentStep > 3 ? 'bg-green-100 text-green-700' : currentStep === 3 ? 'text-white' : 'bg-gray-100 text-gray-400'
                }`} style={currentStep === 3 ? { backgroundColor: 'var(--primary-brand-hex)' } : {}}>
                  {currentStep > 3 ? '✓' : '3'}
                </div>
                <span className={`text-sm ${currentStep >= 3 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  Email Verification
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  currentStep > 4 ? 'bg-green-100 text-green-700' : currentStep === 4 ? 'text-white' : 'bg-gray-100 text-gray-400'
                }`} style={currentStep === 4 ? { backgroundColor: 'var(--primary-brand-hex)' } : {}}>
                  {currentStep > 4 ? '✓' : '4'}
                </div>
                <span className={`text-sm ${currentStep >= 4 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  Security
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  currentStep > 5 ? 'bg-green-100 text-green-700' : currentStep === 5 ? 'text-white' : 'bg-gray-100 text-gray-400'
                }`} style={currentStep === 5 ? { backgroundColor: 'var(--primary-brand-hex)' } : {}}>
                  {currentStep > 5 ? '✓' : '5'}
                </div>
                <span className={`text-sm ${currentStep >= 5 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  Additional Information
                </span>
              </div>
            </div>
          </div>

          {/* Help Text */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Need assistance? Contact our support team at{' '}
              <a href="mailto:support@rhemo.com" className="underline hover:text-gray-700">
                support@rhemo.com
              </a>
              , or go back to our{' '}
              <a href="/login" className="underline hover:text-gray-700">
                login
              </a>
              {' '}page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
