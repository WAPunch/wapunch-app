import { useEffect, useState, useRef } from 'react';
import { useSubmoduleNav } from '../../hooks/useSubmoduleNav';
import { useDepartments } from '../../hooks/useDepartments';
import { useJobTitles } from '../../hooks/useJobTitles';
import { useCompany } from '../../hooks/useCompany';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { router } from '../../lib/router';
import { 
  User, 
  Mail, 
  Phone, 
  Briefcase,
  Building,
  Save,
  X,
  Plus,
  AlertCircle,
} from 'lucide-react';
import phoneRules from '../../../phone_number_rules_global_full.json';

// Default worker data - fallback if no worker is selected
const defaultWorker = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  phoneCountryCode: '+1',
  phoneNumber: '',
  workerType: 'employee' as 'employee' | 'contractor',
  departmentId: '',
  jobTitleId: '',
};

export default function WorkerInfo() {
  const { setBreadcrumbs, clearSubmoduleNav } = useSubmoduleNav();
  const { departments, addDepartment } = useDepartments();
  const { jobTitles, addJobTitle } = useJobTitles();
  const { currentCompany } = useCompany();
  const [worker, setWorker] = useState(defaultWorker);
  const [newDepartment, setNewDepartment] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [showNewDepartment, setShowNewDepartment] = useState(false);
  const [showNewJobTitle, setShowNewJobTitle] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [originalWorker, setOriginalWorker] = useState(defaultWorker);
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);
  const [isAddingJobTitle, setIsAddingJobTitle] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Phone country codes - same as CompanyRegistration
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
    { code: '+998', flag: '🇺🇿', country: 'Uzbekistan', iso: 'UZB' },
  ];

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

  // Función para detectar el country code desde un número completo (sin +)
  const detectCountryCodeFromNumber = (fullNumber: string): { countryCode: string; phoneNumber: string } => {
    const digits = fullNumber.replace(/\D/g, '');
    
    if (!digits) {
      return { countryCode: '+1', phoneNumber: '' };
    }

    // Ordenar los códigos de país por longitud (más largos primero) para detectar correctamente
    const sortedCodes = [...phoneCountryCodes].sort((a, b) => {
      const aDigits = a.code.replace(/\D/g, '').length;
      const bDigits = b.code.replace(/\D/g, '').length;
      return bDigits - aDigits; // Más largos primero
    });

    // Intentar detectar el código de país probando desde los más largos (3 dígitos) hasta los más cortos (1 dígito)
    for (const country of sortedCodes) {
      const codeDigits = country.code.replace(/\D/g, '');
      if (digits.startsWith(codeDigits)) {
        const phoneNumber = digits.substring(codeDigits.length);
        // Validar que el número resultante tenga al menos 4 dígitos (número válido mínimo)
        if (phoneNumber.length >= 4) {
          return { countryCode: country.code, phoneNumber };
        }
      }
    }

    // Si no se encuentra, asumir +1 (USA/Canadá) y usar los últimos 10 dígitos
    if (digits.length > 10) {
      return { countryCode: '+1', phoneNumber: digits.substring(digits.length - 10) };
    }
    
    return { countryCode: '+1', phoneNumber: digits };
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

  useEffect(() => {
    // Load worker data from sessionStorage if available, or fetch from database if ID is in URL
    const loadWorkerData = async () => {
      const selectedWorkerData = sessionStorage.getItem('selectedWorker');
      if (selectedWorkerData) {
        try {
          const parsedWorker = JSON.parse(selectedWorkerData);
          
          // If we have an ID, try to fetch fresh data from database
          if (parsedWorker.id && currentCompany?.id) {
            try {
              const { data: workerData, error: fetchError } = await supabase
                .from('workers')
                .select(`
                  *,
                  department:departments(name),
                  job_title:job_titles(title)
                `)
                .eq('id', parsedWorker.id)
                .eq('company_id', currentCompany.id)
                .eq('is_deleted', false)
                .single();

              if (!fetchError && workerData) {
                // Parse whatsapp_number from database (format: country code + number, all digits)
                let phoneCountryCode = '+1';
                let phoneNumber = '';
                if (workerData.whatsapp_number) {
                  const detected = detectCountryCodeFromNumber(workerData.whatsapp_number);
                  phoneCountryCode = detected.countryCode;
                  phoneNumber = detected.phoneNumber;
                }

                // Debug logging
                if (import.meta.env.DEV) {
                  console.log('📧 Worker email from DB:', workerData.email);
                  console.log('📧 Worker data loaded:', {
                    id: workerData.id,
                    email: workerData.email,
                    whatsapp_number: workerData.whatsapp_number,
                    detectedPhone: { countryCode: phoneCountryCode, number: phoneNumber }
                  });
                }

                // Handle email: use DB value if exists, otherwise fallback to sessionStorage, otherwise empty string
                const workerEmail = workerData.email !== null && workerData.email !== undefined 
                  ? workerData.email 
                  : (parsedWorker.email || '');

                const mappedWorker = {
                  id: workerData.id,
                  firstName: workerData.first_name || '',
                  lastName: workerData.last_name || '',
                  email: workerEmail,
                  phoneCountryCode,
                  phoneNumber,
                  workerType: (workerData.worker_type || 'employee') as 'employee' | 'contractor',
                  departmentId: workerData.department_id || '',
                  jobTitleId: workerData.job_title_id || '',
                };

                // Debug logging
                if (import.meta.env.DEV) {
                  console.log('📥 Loaded worker email:', {
                    fromDB: workerData.email,
                    fromDBType: typeof workerData.email,
                    fromSession: parsedWorker.email,
                    final: mappedWorker.email
                  });
                }

                setWorker(mappedWorker);
                setOriginalWorker(mappedWorker);
                return;
              }
            } catch (dbError) {
              logger.error('Error fetching worker from database', dbError instanceof Error ? dbError : new Error(String(dbError)));
              // Fall through to use sessionStorage data
            }
          }

          // Fallback to sessionStorage data
          // Parse phone number if it exists
          let phoneCountryCode = '+1';
          let phoneNumber = '';
          const phoneValue = parsedWorker.phone || parsedWorker.whatsapp_number;
          if (phoneValue) {
            // If it's already formatted with +, extract it
            if (phoneValue.startsWith('+')) {
              const phoneMatch = phoneValue.match(/^\+(\d{1,3})\s*(.+)$/);
              if (phoneMatch) {
                phoneCountryCode = `+${phoneMatch[1]}`;
                phoneNumber = phoneMatch[2].replace(/\D/g, '');
              } else {
                // Use detection function for digits with +
                const detected = detectCountryCodeFromNumber(phoneValue);
                phoneCountryCode = detected.countryCode;
                phoneNumber = detected.phoneNumber;
              }
            } else {
              // Just digits, use detection function
              const detected = detectCountryCodeFromNumber(phoneValue);
              phoneCountryCode = detected.countryCode;
              phoneNumber = detected.phoneNumber;
            }
          }
          
          const mappedWorker = {
            id: parsedWorker.id || '',
            firstName: parsedWorker.firstName || '',
            lastName: parsedWorker.lastName || '',
            email: parsedWorker.email || '',
            phoneCountryCode,
            phoneNumber,
            workerType: parsedWorker.worker_type || 'employee' as 'employee' | 'contractor',
            departmentId: parsedWorker.department_id || parsedWorker.departmentId || '',
            jobTitleId: parsedWorker.job_title_id || parsedWorker.jobTitleId || '',
          };
          setWorker(mappedWorker);
          setOriginalWorker(mappedWorker);
      } catch (error) {
          logger.error('Error parsing worker data', error instanceof Error ? error : new Error(String(error)));
          setWorker(defaultWorker);
          setOriginalWorker(defaultWorker);
        }
      }
    };

    loadWorkerData();
  }, [currentCompany?.id]);

  useEffect(() => {
    // Clear any existing submodule navigation and set breadcrumbs
    clearSubmoduleNav();
    
    // Create slug from worker name for breadcrumb URLs
    const slug = worker.firstName && worker.lastName 
      ? `${worker.firstName.toLowerCase()}-${worker.lastName.toLowerCase()}`
      : 'new-worker';
    
    setBreadcrumbs([
      { label: 'Workers' },
      { label: 'Directory', href: '/workers/directory' },
      { label: worker.firstName && worker.lastName ? `${worker.firstName} ${worker.lastName}` : 'New Worker' }
    ]);

    // Clear breadcrumbs when component unmounts
    return () => clearSubmoduleNav();
  }, [setBreadcrumbs, clearSubmoduleNav, worker.firstName, worker.lastName]);

  // Track changes
  useEffect(() => {
    const hasChanged = JSON.stringify(worker) !== JSON.stringify(originalWorker);
    setHasChanges(hasChanged);
  }, [worker, originalWorker]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setWorker(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handlePhoneCountryCodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setWorker(prev => ({ ...prev, phoneCountryCode: e.target.value }));
    // Clear phone number error when country code changes
    if (errors.phoneNumber) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.phoneNumber;
        return newErrors;
      });
    }
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setWorker(prev => ({ ...prev, phoneNumber: value }));
    
    // Validate phone number in real-time
    if (value && worker.phoneCountryCode) {
      const validation = validatePhoneNumber(value, worker.phoneCountryCode);
      if (!validation.isValid) {
        setErrors(prev => ({ ...prev, phoneNumber: validation.error }));
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.phoneNumber;
          return newErrors;
        });
      }
    }
  };

  const handleAddDepartment = async () => {
    if (!newDepartment.trim()) return;
    
    // Check if department already exists
    const exists = departments.some(d => d.name.toLowerCase() === newDepartment.trim().toLowerCase());
    if (exists) {
      setErrors(prev => ({ ...prev, department: 'This department already exists' }));
      return;
    }

    setIsAddingDepartment(true);
    try {
      const newDepartmentId = await addDepartment(newDepartment.trim());
      
      // Set the new department ID directly
      setWorker(prev => ({ ...prev, departmentId: newDepartmentId }));
      setNewDepartment('');
      setShowNewDepartment(false);
      
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.department;
        return newErrors;
      });
    } catch (err: any) {
      setErrors(prev => ({ ...prev, department: err?.message || 'Failed to add department' }));
    } finally {
      setIsAddingDepartment(false);
    }
  };

  const handleAddJobTitle = async () => {
    if (!newJobTitle.trim()) return;
    
    // Check if job title already exists
    const exists = jobTitles.some(j => j.name.toLowerCase() === newJobTitle.trim().toLowerCase());
    if (exists) {
      setErrors(prev => ({ ...prev, jobTitle: 'This job title already exists' }));
      return;
    }

    setIsAddingJobTitle(true);
    try {
      const newJobTitleId = await addJobTitle(newJobTitle.trim());
      
      // Set the new job title ID directly
      setWorker(prev => ({ ...prev, jobTitleId: newJobTitleId }));
      setNewJobTitle('');
      setShowNewJobTitle(false);
      
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.jobTitle;
        return newErrors;
      });
    } catch (err: any) {
      setErrors(prev => ({ ...prev, jobTitle: err?.message || 'Failed to add job title' }));
    } finally {
      setIsAddingJobTitle(false);
    }
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};

    if (!worker.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!worker.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    // Email is optional (stored directly in workers table)
    if (worker.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(worker.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!worker.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (worker.phoneCountryCode) {
      const validation = validatePhoneNumber(worker.phoneNumber, worker.phoneCountryCode);
      if (!validation.isValid) {
        newErrors.phoneNumber = validation.error;
      }
    }

    if (!currentCompany?.id) {
      newErrors.general = 'No company selected';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      // Format phone number: remove + and all non-numeric characters, combine country code + number
      const cleanedPhoneNumber = cleanPhoneNumber(worker.phoneNumber);
      const countryCodeDigits = worker.phoneCountryCode.replace(/\D/g, ''); // Remove + from country code
      const whatsappNumber = countryCodeDigits + cleanedPhoneNumber; // Combine: country code + number (all digits, no +)

      // Prepare worker data for database
      // Note: Workers are NOT users. Only Super Admin, Admin, and Manager are users (in company_users table).
      const workerData: any = {
        first_name: worker.firstName.trim(),
        last_name: worker.lastName.trim(),
        whatsapp_number: whatsappNumber,
        worker_type: worker.workerType,
        email: worker.email.trim() || null, // Store email in workers table (null if empty)
      };

      // Debug logging
      if (import.meta.env.DEV) {
        console.log('💾 Saving worker email:', worker.email.trim() || '(empty)');
        console.log('💾 Worker data to save:', workerData);
      }

      // Add optional fields
      if (worker.departmentId) {
        workerData.department_id = worker.departmentId;
      } else {
        workerData.department_id = null;
      }
      if (worker.jobTitleId) {
        workerData.job_title_id = worker.jobTitleId;
      } else {
        workerData.job_title_id = null;
      }

      let savedWorker;
      if (worker.id) {
        // Update existing worker - don't change company_id
        const { data, error: updateError } = await supabase
          .from('workers')
          .update({
            ...workerData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', worker.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        savedWorker = data;
        logger.info('Worker updated', { workerId: worker.id, email: savedWorker.email });
        
        // Debug logging
        if (import.meta.env.DEV) {
          console.log('✅ Worker updated in DB:', {
            id: savedWorker.id,
            email: savedWorker.email,
            emailType: typeof savedWorker.email
          });
        }
      } else {
        // Create new worker - workers are NOT users
        // currentCompany is already validated at the start of handleSave
        if (!currentCompany?.id) {
          throw new Error('No company selected');
        }
        
        const { data, error: insertError } = await supabase
          .from('workers')
          .insert({
            ...workerData,
            company_id: currentCompany.id,
            is_active: true,
            is_deleted: false,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        savedWorker = data;
        logger.info('Worker created', { workerId: savedWorker.id, email: savedWorker.email });
        
        // Debug logging
        if (import.meta.env.DEV) {
          console.log('✅ Worker created in DB:', {
            id: savedWorker.id,
            email: savedWorker.email,
            emailType: typeof savedWorker.email
          });
        }
      }

      // Update worker state with saved data
      // Preserve email: use saved email if it exists (even if empty string), otherwise use current worker email
      const savedEmail = savedWorker.email !== null && savedWorker.email !== undefined 
        ? savedWorker.email 
        : (worker.email || '');

      const updatedWorker = {
        ...worker,
        id: savedWorker.id,
        email: savedEmail, // Preserve email from saved data
      };

      // Debug logging
      if (import.meta.env.DEV) {
        console.log('✅ Worker saved successfully:', {
          id: savedWorker.id,
          savedEmailFromDB: savedWorker.email,
          savedEmailType: typeof savedWorker.email,
          currentWorkerEmail: worker.email,
          finalUpdatedEmail: updatedWorker.email
        });
      }

      setWorker(updatedWorker);
      setOriginalWorker(updatedWorker);
      setHasChanges(false);
      setErrors({});

      // Show success message (you can add a toast notification here)
      if (import.meta.env.DEV) {
        console.log('✅ Worker saved successfully:', savedWorker);
      }

      // Refresh the workers list by navigating back or refreshing
      // Optionally, you could call a refetch function here
      
    } catch (err: any) {
      logger.error('Error saving worker', err);
      setErrors({ general: err?.message || 'Failed to save worker. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setWorker(originalWorker);
    setErrors({});
    setHasChanges(false);
  };

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-title font-semibold text-foreground mb-1">Worker Profile</h1>
        <p className="text-small text-muted-foreground">
          {worker.firstName && worker.lastName 
            ? `Edit ${worker.firstName} ${worker.lastName}'s information`
            : 'Add or edit worker information'}
        </p>
      </div>

      {/* Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {errors.general && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {errors.general}
        </div>
        )}
        <div className="space-y-6">
          {/* First Name and Last Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
            <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={worker.firstName}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.firstName ? 'border-red-300 focus:ring-red-500' : ''
                  }`}
                  placeholder="Enter first name"
                />
                </div>
              {errors.firstName && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.firstName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={worker.lastName}
                  onChange={handleInputChange}
                  className={`w-full pl-10 pr-3 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.lastName ? 'border-red-300 focus:ring-red-500' : ''
                  }`}
                  placeholder="Enter last name"
                />
              </div>
              {errors.lastName && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.lastName}
                </p>
              )}
                </div>
              </div>

          {/* Worker Type */}
          <div>
            <label htmlFor="workerType" className="block text-sm font-medium text-gray-700 mb-2">
              Worker Type *
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                id="workerType"
                name="workerType"
                value={worker.workerType}
                onChange={handleInputChange}
                className="w-full pl-10 pr-3 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
              >
                <option value="employee">Employee</option>
                <option value="contractor">Contractor</option>
              </select>
            </div>
          </div>

          {/* Department */}
          <div>
            <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700 mb-2">
              Department
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <div className="flex gap-2">
                <select
                  id="departmentId"
                  name="departmentId"
                  value={worker.departmentId}
                  onChange={handleInputChange}
                  className="flex-1 pl-10 pr-3 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
                >
                  <option value="">Select department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
                {!showNewDepartment ? (
                  <button
                    type="button"
                    onClick={() => setShowNewDepartment(true)}
                    className="px-3 h-10 border border-gray-300 rounded-md text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New
            </button>
                ) : (
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddDepartment();
                        } else if (e.key === 'Escape') {
                          setShowNewDepartment(false);
                          setNewDepartment('');
                        }
                      }}
                      className="flex-1 px-3 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter new department"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddDepartment}
                      disabled={isAddingDepartment}
                      className={`px-3 h-10 bg-primary text-white rounded-md text-sm hover:bg-primary/90 ${
                        isAddingDepartment ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {isAddingDepartment ? 'Adding...' : 'Add'}
            </button>
              <button
                      type="button"
                      onClick={() => {
                        setShowNewDepartment(false);
                        setNewDepartment('');
                      }}
                      className="px-3 h-10 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                </div>
              )}
          </div>
        </div>
      </div>

          {/* Job Title */}
          <div>
            <label htmlFor="jobTitleId" className="block text-sm font-medium text-gray-700 mb-2">
              Job Title
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <div className="flex gap-2">
                <select
                  id="jobTitleId"
                  name="jobTitleId"
                  value={worker.jobTitleId}
                  onChange={handleInputChange}
                  className="flex-1 pl-10 pr-3 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
                >
                  <option value="">Select job title</option>
                  {jobTitles.map(title => (
                    <option key={title.id} value={title.id}>{title.name}</option>
                  ))}
                </select>
                {!showNewJobTitle ? (
                  <button
                    type="button"
                    onClick={() => setShowNewJobTitle(true)}
                    className="px-3 h-10 border border-gray-300 rounded-md text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New
                  </button>
                ) : (
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      value={newJobTitle}
                      onChange={(e) => setNewJobTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddJobTitle();
                        } else if (e.key === 'Escape') {
                          setShowNewJobTitle(false);
                          setNewJobTitle('');
                        }
                      }}
                      className="flex-1 px-3 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter new job title"
                      autoFocus
                    />
            <button
                      type="button"
                      onClick={handleAddJobTitle}
                      disabled={isAddingJobTitle}
                      className={`px-3 h-10 bg-primary text-white rounded-md text-sm hover:bg-primary/90 ${
                        isAddingJobTitle ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {isAddingJobTitle ? 'Adding...' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewJobTitle(false);
                        setNewJobTitle('');
                      }}
                      className="px-3 h-10 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                    >
                      <X className="w-4 h-4" />
            </button>
                  </div>
                )}
              </div>
            </div>
            {errors.jobTitle && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.jobTitle}
              </p>
            )}
                  </div>

          {/* Email */}
                  <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="email"
                name="email"
                type="email"
                value={worker.email}
                onChange={handleInputChange}
                className={`w-full pl-10 pr-3 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.email ? 'border-red-300 focus:ring-red-500' : ''
                }`}
                placeholder="Enter email address"
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.email}
              </p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phoneCountryCode" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <div className="flex gap-2">
              <div className="relative w-32">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  id="phoneCountryCode"
                  name="phoneCountryCode"
                  value={worker.phoneCountryCode}
                  onChange={handlePhoneCountryCodeChange}
                  className={`w-full pl-10 pr-3 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 appearance-none ${
                    worker.phoneCountryCode ? 'text-transparent' : ''
                  }`}
                >
                  <option value="">Area Code</option>
                  {phoneCountryCodes.map((country, index) => (
                    <option key={`${country.code}-${country.iso}-${index}`} value={country.code}>
                      {country.iso} {country.flag} {country.code}
                    </option>
                  ))}
                </select>
                {worker.phoneCountryCode && (
                  <div className="absolute inset-y-0 left-0 right-0 flex items-center pl-10 pointer-events-none">
                    <span className="text-sm">
                      {getSelectedCountry(worker.phoneCountryCode)?.flag} {worker.phoneCountryCode}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  value={worker.phoneNumber}
                  onChange={handlePhoneNumberChange}
                  className={`w-full px-3 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 ${
                    errors.phoneNumber 
                      ? 'border-red-300 focus:ring-red-500' 
                      : ''
                  }`}
                  placeholder={(() => {
                    const phoneInfo = getPhoneInfo(worker.phoneCountryCode);
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
            {errors.department && (
              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {errors.department}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleCancel}
              disabled={!hasChanges}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                hasChanges
                  ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  : 'border border-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || !worker.firstName.trim() || !worker.lastName.trim() || !worker.phoneNumber.trim() || isSaving}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                hasChanges && worker.firstName.trim() && worker.lastName.trim() && worker.phoneNumber.trim() && !isSaving
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          </div>
        </div>
    </div>
  );
}
