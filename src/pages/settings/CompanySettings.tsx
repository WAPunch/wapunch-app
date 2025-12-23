import { useState, useEffect } from 'react';
import { router } from '../../lib/router';
import { usePreviousPage } from '../../hooks/usePreviousPage';
import {
  Building,
  Users,
  Clock,
  DollarSign,
  UserCheck,
  Settings as SettingsIcon,
  ChevronRight,
  X,
  BookOpen,
  Upload,
  MapPin,
  Phone as PhoneIcon,
  Mail,
  Globe,
  Building2,
  Zap
} from 'lucide-react';
import { countries } from '../../lib/countries';
import phoneRules from '../../../phone_number_rules_global_full.json';

interface CompanyFormData {
  companyName: string;
  industry: string;
  address: string;
  city: string;
  country: string;
  phoneCountryCode: string;
  phoneNumber: string;
  email: string;
  website: string;
  logo: string | null;
}

export default function CompanySettings() {
  const { getPreviousPage } = usePreviousPage();
  const [activeSection, setActiveSection] = useState<string>('company-info');
  
  // Company form state
  const [companyData, setCompanyData] = useState<CompanyFormData>({
    companyName: 'Arquiluz S.A.',
    industry: 'architecture',
    address: '123 Business Avenue',
    city: 'San Francisco',
    country: 'United States',
    phoneCountryCode: '+1',
    phoneNumber: '(555) 123-4567',
    email: 'contact@arquiluz.com',
    website: 'https://www.arquiluz.com',
    logo: null
  });
  
  const [originalCompanyData, setOriginalCompanyData] = useState<CompanyFormData>(companyData);
  const [hasChanges, setHasChanges] = useState(false);
  const [phoneErrors, setPhoneErrors] = useState<{ phoneNumber?: string }>({});

  // Phone country codes list (same as CompanyRegistration)
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
  ].sort((a, b) => {
    // For +1, prioritize USA (USA) over Canada (CAN)
    if (a.code === '+1' && b.code === '+1') {
      if (a.iso === 'USA') return -1;
      if (b.iso === 'USA') return 1;
    }
    return a.iso.localeCompare(b.iso);
  });

  // Phone utility functions
  const getPhoneInfo = (callingCode: string) => {
    const rule = phoneRules.rules.find(rule => rule.calling_code === callingCode);
    return rule || phoneRules.fallback;
  };

  const getSelectedCountry = (callingCode: string) => {
    // For +1, prioritize USA over Canada
    if (callingCode === '+1') {
      return phoneCountryCodes.find(country => country.code === '+1' && country.iso === 'USA') || 
             phoneCountryCodes.find(country => country.code === '+1');
    }
    return phoneCountryCodes.find(country => country.code === callingCode);
  };

  const cleanPhoneNumber = (phoneNumber: string) => {
    return phoneNumber.replace(/\D/g, '');
  };

  // Format phone number according to country rules
  const formatPhoneNumber = (phoneNumber: string, callingCode: string): string => {
    const cleanNumber = cleanPhoneNumber(phoneNumber);
    if (!cleanNumber) return '';
    
    const phoneInfo = getPhoneInfo(callingCode) as any;
    
    // If no formats available, return cleaned number
    if (!phoneInfo.formats || phoneInfo.formats.length === 0) {
      return cleanNumber;
    }
    
    // Try each format pattern
    for (const formatRule of phoneInfo.formats) {
      const pattern = new RegExp(formatRule.pattern);
      const match = cleanNumber.match(pattern);
      
      if (match) {
        let formatted = formatRule.format;
        // Replace \1, \2, etc. with captured groups
        for (let i = 1; i < match.length; i++) {
          const regex = new RegExp(`\\\\${i}`, 'g');
          formatted = formatted.replace(regex, match[i]);
        }
        return formatted;
      }
    }
    
    // If no pattern matches, return cleaned number
    return cleanNumber;
  };

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

  // Handle ESC key to close settings and return to previous page
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const previousPage = getPreviousPage();
        const targetPage = previousPage || '/dashboard';
        try {
          router.navigate(targetPage);
        } catch (error) {
          window.location.href = targetPage;
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [getPreviousPage]);

  // Check for changes in company data
  useEffect(() => {
    const dataChanged = JSON.stringify(companyData) !== JSON.stringify(originalCompanyData);
    setHasChanges(dataChanged);
  }, [companyData, originalCompanyData]);

  // Settings menu configuration
  const settingsMenu = [
    { id: 'company-info', label: 'Company', icon: Building },
    { id: 'time-and-attendance', label: 'Time & Attendance', icon: Clock },
    { id: 'users', label: 'Users', icon: UserCheck },
    { id: 'billing', label: 'Billing', icon: DollarSign },
    { id: 'integrations', label: 'Integrations', icon: Zap }
  ];

  const handleSectionChange = (sectionId: string): void => {
    setActiveSection(sectionId);
  };

  const handleCloseSettings = (): void => {
    const previousPage = getPreviousPage();
    const targetPage = previousPage || '/dashboard';
    try {
      router.navigate(targetPage);
    } catch (error) {
      window.location.href = targetPage;
    }
  };

  const renderTabContent = () => {
    if (activeSection === 'company-info') {
          const handleCompanyChange = (field: keyof CompanyFormData, value: string) => {
            setCompanyData(prev => ({ ...prev, [field]: value }));
          };

          const handleSaveCompany = () => {
            // Validate phone number if provided
            if (companyData.phoneNumber.trim() && companyData.phoneCountryCode) {
              const validation = validatePhoneNumber(companyData.phoneNumber, companyData.phoneCountryCode);
              if (!validation.isValid) {
                setPhoneErrors({ phoneNumber: validation.error });
                return;
              }
            }
            
            setPhoneErrors({});
            // TODO: Save to backend
            setOriginalCompanyData(companyData);
            setHasChanges(false);
          };

          const handleCancelCompany = () => {
            setCompanyData(originalCompanyData);
            setHasChanges(false);
          };

      const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setCompanyData(prev => ({ ...prev, logo: reader.result as string }));
          };
          reader.readAsDataURL(file);
        }
      };

      return (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="space-y-8">
                {/* Company Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Company Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                      {companyData.logo ? (
                        <img src={companyData.logo} alt="Company logo" className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <Building2 className="w-10 h-10 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        id="logo-upload"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Logo
                      </label>
                      <p className="text-xs text-gray-500 mt-2">PNG, JPG or SVG (max. 2MB)</p>
                    </div>
                  </div>
                </div>

                {/* Company Name - Mandatory */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyData.companyName}
                    onChange={(e) => handleCompanyChange('companyName', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Enter company name"
                  />
                </div>

                {/* Industry Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                  <select
                    value={companyData.industry}
                    onChange={(e) => handleCompanyChange('industry', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select an industry</option>
                    <option value="architecture">Architecture & Design</option>
                    <option value="technology">Technology & Software</option>
                    <option value="construction">Construction</option>
                    <option value="consulting">Consulting</option>
                    <option value="education">Education</option>
                    <option value="finance">Finance & Banking</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="hospitality">Hospitality</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="retail">Retail</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Address Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Address
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                    <input
                      type="text"
                      value={companyData.address}
                      onChange={(e) => handleCompanyChange('address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter street address"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                      <input
                        type="text"
                        value={companyData.city}
                        onChange={(e) => handleCompanyChange('city', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Enter city"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                      <select
                        value={companyData.country}
                        onChange={(e) => handleCompanyChange('country', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">Select a country</option>
                        {countries.map((country) => (
                          <option key={country.code} value={country.name}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900">Contact Information</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <PhoneIcon className="w-4 h-4" />
                        Phone
                      </label>
                      <div className="flex gap-2">
                        <div className="relative w-32">
                          <PhoneIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <select
                            value={companyData.phoneCountryCode}
                            onChange={(e) => {
                              handleCompanyChange('phoneCountryCode', e.target.value);
                              setPhoneErrors({});
                            }}
                            className={`w-full pl-10 pr-3 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none ${
                              companyData.phoneCountryCode ? 'text-transparent' : ''
                            }`}
                          >
                            <option value="">Area Code</option>
                            {phoneCountryCodes.map((country, index) => {
                              // For +1, only show USA in the dropdown to avoid confusion
                              if (country.code === '+1' && country.iso !== 'USA') {
                                return null;
                              }
                              return (
                                <option key={`${country.code}-${country.iso}-${index}`} value={country.code}>
                                  {country.iso} {country.flag} {country.code}
                                </option>
                              );
                            })}
                          </select>
                          {companyData.phoneCountryCode && (
                            <div className="absolute inset-y-0 left-0 right-0 flex items-center pl-10 pointer-events-none">
                              <span className="text-sm">
                                {getSelectedCountry(companyData.phoneCountryCode)?.flag} {companyData.phoneCountryCode}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                      <input
                        type="tel"
                            value={companyData.phoneNumber}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              const cleanValue = cleanPhoneNumber(inputValue);
                              
                              // Format as user types if we have enough digits
                              if (companyData.phoneCountryCode && cleanValue.length > 0) {
                                const formatted = formatPhoneNumber(cleanValue, companyData.phoneCountryCode);
                                handleCompanyChange('phoneNumber', formatted);
                              } else {
                                handleCompanyChange('phoneNumber', inputValue);
                              }
                              setPhoneErrors({});
                            }}
                            onBlur={() => {
                              // Final format and validate when user leaves the field
                              if (companyData.phoneCountryCode && companyData.phoneNumber.trim()) {
                                const cleanValue = cleanPhoneNumber(companyData.phoneNumber);
                                const formatted = formatPhoneNumber(cleanValue, companyData.phoneCountryCode);
                                handleCompanyChange('phoneNumber', formatted);
                                
                                // Validate after formatting
                                const validation = validatePhoneNumber(formatted, companyData.phoneCountryCode);
                                if (!validation.isValid) {
                                  setPhoneErrors({ phoneNumber: validation.error });
                                } else {
                                  setPhoneErrors({});
                                }
                              }
                            }}
                            className={`w-full px-3 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                              phoneErrors.phoneNumber 
                                ? 'border-red-300 focus:ring-red-500' 
                                : ''
                            }`}
                            placeholder={(() => {
                              const phoneInfo = getPhoneInfo(companyData.phoneCountryCode || '+1');
                              return phoneInfo.example_national || 'Enter phone number';
                            })()}
                          />
                        </div>
                      </div>
                      {phoneErrors.phoneNumber && (
                        <p className="mt-1 text-sm text-red-600">{phoneErrors.phoneNumber}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </label>
                      <input
                        type="email"
                        value={companyData.email}
                        onChange={(e) => handleCompanyChange('email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="contact@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      Website
                    </label>
                    <input
                      type="url"
                      value={companyData.website}
                      onChange={(e) => handleCompanyChange('website', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="https://www.company.com"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleSaveCompany}
                    disabled={!hasChanges || !companyData.companyName.trim()}
                    className={`px-6 py-2 rounded-md font-medium transition-colors ${
                      hasChanges && companyData.companyName.trim()
                        ? 'bg-primary text-white hover:bg-primary/90'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancelCompany}
                    disabled={!hasChanges}
                    className={`px-6 py-2 rounded-md font-medium transition-colors ${
                      hasChanges
                        ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
      );
    }

    // Default content for other sections
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <SettingsIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {settingsMenu.find(item => item.id === activeSection)?.label} Settings
        </h3>
        <p className="text-gray-500">
          Configuration options for {settingsMenu.find(item => item.id === activeSection)?.label.toLowerCase()} will be available here.
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 fixed inset-0 z-50">
      {/* Settings Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="flex items-center h-12 px-6">
          <div className="flex items-center gap-3">
            <SettingsIcon className="text-gray-900" style={{ width: '20px', height: '20px' }} />
            <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
          </div>

          <div className="h-6 w-px bg-gray-200 ml-6 mr-6" style={{ marginLeft: '111px' }}></div>

          <div className="flex items-center gap-2" style={{ marginLeft: '4px' }}>
            <Building className="text-gray-900" style={{ width: '18px', height: '18px' }} />
            <span className="text-sm font-medium text-gray-900">Arquiluz S.A.</span>
          </div>

          <div className="ml-auto">
            <button
              onClick={handleCloseSettings}
              className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="Close Settings (ESC)"
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Layout */}
      <div className="flex h-[calc(100vh-48px)]">
        {/* Settings Sidebar */}
        <div className="bg-white border-r border-gray-200 flex-shrink-0" style={{ width: '240px' }}>
          <nav className="px-4 pt-6 pb-4">
            <ul className="space-y-1">
              {settingsMenu.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleSectionChange(item.id)}
                      className={`w-full flex items-center justify-between px-4 py-2 text-left rounded transition-colors ${
                        isActive
                          ? 'bg-primary text-white shadow-sm'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon style={{ width: '16px', height: '16px' }} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && (
                        <ChevronRight className="flex-shrink-0" style={{ width: '16px', height: '16px' }} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
      </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Settings Content */}
          <div className="flex-1 overflow-auto" style={{ padding: '28px 32px 32px 32px' }}>
            <div className="max-w-6xl">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {settingsMenu.find(item => item.id === activeSection)?.label}
                </h2>
                <p className="text-sm text-gray-600">
                  Configure and manage your {settingsMenu.find(item => item.id === activeSection)?.label.toLowerCase()} settings and content.
                </p>
              </div>
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
