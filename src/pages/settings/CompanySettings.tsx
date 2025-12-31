import { useState, useEffect } from 'react';
import { router } from '../../lib/router';
import { usePreviousPage } from '../../hooks/usePreviousPage';
import { useCompany } from '../../hooks/useCompany';
import { supabase } from '../../lib/supabase';
import {
  Building,
  Users,
  Clock,
  Calendar,
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
  Zap,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import { countries } from '../../lib/countries';
import phoneRules from '../../../phone_number_rules_global_full.json';
import { useCompanyStore } from '../../stores/company-store';

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
  timezone: string;
}

export default function CompanySettings() {
  const { getPreviousPage } = usePreviousPage();
  const { currentCompany } = useCompany();
  const [activeSection, setActiveSection] = useState<string>('company-info');
  
  // Attendance settings state
  const [attendanceSettings, setAttendanceSettings] = useState({
    late_tolerance_minutes: 5,
    early_leave_tolerance_minutes: 5,
    early_arrival_tolerance_minutes: 0,
    late_departure_tolerance_minutes: 0,
    overtime_calculation_mode: 'daily_total' as 'daily_total' | 'per_shift'
  });
  const [originalAttendanceSettings, setOriginalAttendanceSettings] = useState(attendanceSettings);
  const [attendanceSettingsLoading, setAttendanceSettingsLoading] = useState(true);
  const [attendanceSettingsHasChanges, setAttendanceSettingsHasChanges] = useState(false);
  
  // Fixed schedules state
  const [fixedSchedules, setFixedSchedules] = useState<any[]>([]);
  const [fixedSchedulesLoading, setFixedSchedulesLoading] = useState(true);
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [newScheduleName, setNewScheduleName] = useState('');
  const [scheduleDays, setScheduleDays] = useState<Array<{
    day_of_week: number;
    day_name: string;
    is_working: boolean;
    start_time: string;
    end_time: string;
    break_minutes: number;
  }>>([
    { day_of_week: 1, day_name: 'Monday', is_working: true, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
    { day_of_week: 2, day_name: 'Tuesday', is_working: true, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
    { day_of_week: 3, day_name: 'Wednesday', is_working: true, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
    { day_of_week: 4, day_name: 'Thursday', is_working: true, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
    { day_of_week: 5, day_name: 'Friday', is_working: true, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
    { day_of_week: 6, day_name: 'Saturday', is_working: false, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
    { day_of_week: 0, day_name: 'Sunday', is_working: false, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
  ]);
  
  // Company form state
  const [companyData, setCompanyData] = useState<CompanyFormData>({
    companyName: '',
    industry: '',
    address: '',
    city: '',
    country: '',
    phoneCountryCode: '+1',
    phoneNumber: '',
    email: '',
    website: '',
    logo: null,
    timezone: 'UTC'
  });
  
  const [originalCompanyData, setOriginalCompanyData] = useState<CompanyFormData>(companyData);
  const [hasChanges, setHasChanges] = useState(false);
  const [phoneErrors, setPhoneErrors] = useState<{ phoneNumber?: string }>({});
  const [companyLoading, setCompanyLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

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
  ].sort((a, b) => a.iso.localeCompare(b.iso));

  // Build a deduplicated list of calling-code options (because the stored value is the calling code, e.g. "+1")
  // We pick a single representative country per calling code to avoid ambiguous selections.
  const phoneCountryCodeOptions = (() => {
    const byCode = new Map<string, typeof phoneCountryCodes>();
    for (const entry of phoneCountryCodes) {
      const list = byCode.get(entry.code) || [];
      list.push(entry);
      byCode.set(entry.code, list);
    }

    const preferredIsoByCode: Record<string, string> = {
      '+1': 'USA',
      '+7': 'RUS',
    };

    const options: Array<(typeof phoneCountryCodes)[number]> = [];
    for (const [code, entries] of byCode.entries()) {
      const preferredIso = preferredIsoByCode[code];
      const preferred = preferredIso ? entries.find((e) => e.iso === preferredIso) : undefined;
      const fallback = [...entries].sort((a, b) => a.iso.localeCompare(b.iso))[0];
      options.push(preferred || fallback);
    }

    return options.sort((a, b) => a.iso.localeCompare(b.iso));
  })();

  // Phone utility functions
  const getPhoneInfo = (callingCode: string) => {
    const rule = phoneRules.rules.find(rule => rule.calling_code === callingCode);
    return rule || phoneRules.fallback;
  };

  const getSelectedCountry = (callingCode: string) => {
    return phoneCountryCodeOptions.find(country => country.code === callingCode);
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

  // Load attendance settings
  useEffect(() => {
    const loadAttendanceSettings = async () => {
      if (!currentCompany?.id) {
        setAttendanceSettingsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('company_attendance_settings')
          .select('late_tolerance_minutes, early_leave_tolerance_minutes, early_arrival_tolerance_minutes, late_departure_tolerance_minutes, overtime_calculation_mode')
          .eq('company_id', currentCompany.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error loading attendance settings:', error);
        }

        if (data) {
          setAttendanceSettings({
            late_tolerance_minutes: data.late_tolerance_minutes || 5,
            early_leave_tolerance_minutes: data.early_leave_tolerance_minutes || 5,
            early_arrival_tolerance_minutes: data.early_arrival_tolerance_minutes ?? 0,
            late_departure_tolerance_minutes: data.late_departure_tolerance_minutes ?? 0,
            overtime_calculation_mode: (data.overtime_calculation_mode || 'daily_total') as 'daily_total' | 'per_shift'
          });
          setOriginalAttendanceSettings({
            late_tolerance_minutes: data.late_tolerance_minutes || 5,
            early_leave_tolerance_minutes: data.early_leave_tolerance_minutes || 5,
            early_arrival_tolerance_minutes: data.early_arrival_tolerance_minutes ?? 0,
            late_departure_tolerance_minutes: data.late_departure_tolerance_minutes ?? 0,
            overtime_calculation_mode: (data.overtime_calculation_mode || 'daily_total') as 'daily_total' | 'per_shift'
          });
        }
      } catch (err) {
        console.error('Error loading attendance settings:', err);
      } finally {
        setAttendanceSettingsLoading(false);
      }
    };

    loadAttendanceSettings();
  }, [currentCompany?.id]);

  // Load fixed schedules
  useEffect(() => {
    const loadFixedSchedules = async () => {
      if (!currentCompany?.id) {
        setFixedSchedulesLoading(false);
        return;
      }

      try {
        setFixedSchedulesLoading(true);
        const { data, error } = await supabase
          .from('fixed_schedules')
          .select(`
            *,
            fixed_schedule_days (
              id,
              day_of_week,
              is_working,
              start_time,
              end_time,
              break_minutes
            )
          `)
          .eq('company_id', currentCompany.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setFixedSchedules(data || []);
      } catch (err) {
        console.error('Error loading fixed schedules:', err);
      } finally {
        setFixedSchedulesLoading(false);
      }
    };

    if (activeSection === 'schedule') {
      loadFixedSchedules();
    }
  }, [currentCompany?.id, activeSection]);

  // Map countries to their most common IANA timezone
  const getTimezoneForCountry = (countryName: string): string => {
    const countryTimezoneMap: Record<string, string> = {
      'United States': 'America/New_York',
      'Canada': 'America/Toronto',
      'Mexico': 'America/Mexico_City',
      'Brazil': 'America/Sao_Paulo',
      'Argentina': 'America/Argentina/Buenos_Aires',
      'Chile': 'America/Santiago',
      'Colombia': 'America/Bogota',
      'Peru': 'America/Lima',
      'Venezuela': 'America/Caracas',
      'Ecuador': 'America/Guayaquil',
      'United Kingdom': 'Europe/London',
      'France': 'Europe/Paris',
      'Germany': 'Europe/Berlin',
      'Spain': 'Europe/Madrid',
      'Italy': 'Europe/Rome',
      'Netherlands': 'Europe/Amsterdam',
      'Belgium': 'Europe/Brussels',
      'Switzerland': 'Europe/Zurich',
      'Austria': 'Europe/Vienna',
      'Sweden': 'Europe/Stockholm',
      'Norway': 'Europe/Oslo',
      'Denmark': 'Europe/Copenhagen',
      'Finland': 'Europe/Helsinki',
      'Poland': 'Europe/Warsaw',
      'Portugal': 'Europe/Lisbon',
      'Greece': 'Europe/Athens',
      'Ireland': 'Europe/Dublin',
      'Russia': 'Europe/Moscow',
      'Turkey': 'Europe/Istanbul',
      'Ukraine': 'Europe/Kiev',
      'China': 'Asia/Shanghai',
      'Japan': 'Asia/Tokyo',
      'India': 'Asia/Kolkata',
      'South Korea': 'Asia/Seoul',
      'Singapore': 'Asia/Singapore',
      'Malaysia': 'Asia/Kuala_Lumpur',
      'Thailand': 'Asia/Bangkok',
      'Philippines': 'Asia/Manila',
      'Indonesia': 'Asia/Jakarta',
      'Vietnam': 'Asia/Ho_Chi_Minh',
      'Australia': 'Australia/Sydney',
      'New Zealand': 'Pacific/Auckland',
      'South Africa': 'Africa/Johannesburg',
      'Egypt': 'Africa/Cairo',
      'Nigeria': 'Africa/Lagos',
      'Kenya': 'Africa/Nairobi',
      'Saudi Arabia': 'Asia/Riyadh',
      'United Arab Emirates': 'Asia/Dubai',
      'Israel': 'Asia/Jerusalem',
      'Iran': 'Asia/Tehran',
      'Iraq': 'Asia/Baghdad',
      'Pakistan': 'Asia/Karachi',
      'Bangladesh': 'Asia/Dhaka',
      'Sri Lanka': 'Asia/Colombo',
      'Nepal': 'Asia/Kathmandu',
      'Myanmar': 'Asia/Yangon',
      'Afghanistan': 'Asia/Kabul',
      'Kazakhstan': 'Asia/Almaty',
      'Uzbekistan': 'Asia/Tashkent',
      'Kyrgyzstan': 'Asia/Bishkek',
      'Tajikistan': 'Asia/Dushanbe',
      'Turkmenistan': 'Asia/Ashgabat',
      'Mongolia': 'Asia/Ulaanbaatar',
      'North Korea': 'Asia/Pyongyang',
      'Taiwan': 'Asia/Taipei',
      'Hong Kong': 'Asia/Hong_Kong',
      'Macao': 'Asia/Macau',
      'Brunei': 'Asia/Brunei',
      'Cambodia': 'Asia/Phnom_Penh',
      'Laos': 'Asia/Vientiane',
      'Timor-Leste': 'Asia/Dili',
      'Papua New Guinea': 'Pacific/Port_Moresby',
      'Fiji': 'Pacific/Fiji',
      'Samoa': 'Pacific/Apia',
      'Tonga': 'Pacific/Tongatapu',
      'Vanuatu': 'Pacific/Efate',
      'Solomon Islands': 'Pacific/Guadalcanal',
      'New Caledonia': 'Pacific/Noumea',
      'French Polynesia': 'Pacific/Tahiti',
      'Guam': 'Pacific/Guam',
      'Northern Mariana Islands': 'Pacific/Saipan',
      'Palau': 'Pacific/Palau',
      'Micronesia': 'Pacific/Chuuk',
      'Marshall Islands': 'Pacific/Majuro',
      'Kiribati': 'Pacific/Tarawa',
      'Nauru': 'Pacific/Nauru',
      'Tuvalu': 'Pacific/Funafuti',
      'Algeria': 'Africa/Algiers',
      'Morocco': 'Africa/Casablanca',
      'Tunisia': 'Africa/Tunis',
      'Libya': 'Africa/Tripoli',
      'Sudan': 'Africa/Khartoum',
      'Ethiopia': 'Africa/Addis_Ababa',
      'Tanzania': 'Africa/Dar_es_Salaam',
      'Uganda': 'Africa/Kampala',
      'Rwanda': 'Africa/Kigali',
      'Burundi': 'Africa/Bujumbura',
      'Democratic Republic of the Congo': 'Africa/Kinshasa',
      'Republic of the Congo': 'Africa/Brazzaville',
      'Cameroon': 'Africa/Douala',
      'Chad': 'Africa/Ndjamena',
      'Central African Republic': 'Africa/Bangui',
      'Gabon': 'Africa/Libreville',
      'Equatorial Guinea': 'Africa/Malabo',
      'Sao Tome and Principe': 'Africa/Sao_Tome',
      'Angola': 'Africa/Luanda',
      'Zambia': 'Africa/Lusaka',
      'Malawi': 'Africa/Blantyre',
      'Mozambique': 'Africa/Maputo',
      'Zimbabwe': 'Africa/Harare',
      'Botswana': 'Africa/Gaborone',
      'Namibia': 'Africa/Windhoek',
      'Lesotho': 'Africa/Maseru',
      'Eswatini': 'Africa/Mbabane',
      'Madagascar': 'Indian/Antananarivo',
      'Mauritius': 'Indian/Mauritius',
      'Seychelles': 'Indian/Mahe',
      'Comoros': 'Indian/Comoro',
      'Maldives': 'Indian/Maldives',
      'Sri Lanka': 'Asia/Colombo',
      'Cabo Verde': 'Atlantic/Cape_Verde',
      'Senegal': 'Africa/Dakar',
      'Gambia': 'Africa/Banjul',
      'Guinea-Bissau': 'Africa/Bissau',
      'Guinea': 'Africa/Conakry',
      'Sierra Leone': 'Africa/Freetown',
      'Liberia': 'Africa/Monrovia',
      'Ivory Coast': 'Africa/Abidjan',
      'Ghana': 'Africa/Accra',
      'Togo': 'Africa/Lome',
      'Benin': 'Africa/Porto-Novo',
      'Burkina Faso': 'Africa/Ouagadougou',
      'Mali': 'Africa/Bamako',
      'Niger': 'Africa/Niamey',
      'Mauritania': 'Africa/Nouakchott',
      'Djibouti': 'Africa/Djibouti',
      'Eritrea': 'Africa/Asmara',
      'Somalia': 'Africa/Mogadishu',
      'Cuba': 'America/Havana',
      'Jamaica': 'America/Jamaica',
      'Haiti': 'America/Port-au-Prince',
      'Dominican Republic': 'America/Santo_Domingo',
      'Puerto Rico': 'America/Puerto_Rico',
      'Trinidad and Tobago': 'America/Port_of_Spain',
      'Barbados': 'America/Barbados',
      'Bahamas': 'America/Nassau',
      'Belize': 'America/Belize',
      'Guatemala': 'America/Guatemala',
      'El Salvador': 'America/El_Salvador',
      'Honduras': 'America/Tegucigalpa',
      'Nicaragua': 'America/Managua',
      'Costa Rica': 'America/Costa_Rica',
      'Panama': 'America/Panama',
      'Uruguay': 'America/Montevideo',
      'Paraguay': 'America/Asuncion',
      'Bolivia': 'America/La_Paz',
      'Guyana': 'America/Guyana',
      'Suriname': 'America/Paramaribo',
      'French Guiana': 'America/Cayenne',
      'Falkland Islands': 'Atlantic/Stanley',
      'Greenland': 'America/Nuuk',
      'Iceland': 'Atlantic/Reykjavik',
      'Faroe Islands': 'Atlantic/Faroe',
      'Svalbard and Jan Mayen': 'Arctic/Longyearbyen',
      'Albania': 'Europe/Tirane',
      'Andorra': 'Europe/Andorra',
      'Armenia': 'Asia/Yerevan',
      'Azerbaijan': 'Asia/Baku',
      'Belarus': 'Europe/Minsk',
      'Bosnia and Herzegovina': 'Europe/Sarajevo',
      'Bulgaria': 'Europe/Sofia',
      'Croatia': 'Europe/Zagreb',
      'Cyprus': 'Asia/Nicosia',
      'Czech Republic': 'Europe/Prague',
      'Estonia': 'Europe/Tallinn',
      'Georgia': 'Asia/Tbilisi',
      'Hungary': 'Europe/Budapest',
      'Latvia': 'Europe/Riga',
      'Lithuania': 'Europe/Vilnius',
      'Luxembourg': 'Europe/Luxembourg',
      'Malta': 'Europe/Malta',
      'Moldova': 'Europe/Chisinau',
      'Monaco': 'Europe/Monaco',
      'Montenegro': 'Europe/Podgorica',
      'North Macedonia': 'Europe/Skopje',
      'Romania': 'Europe/Bucharest',
      'San Marino': 'Europe/San_Marino',
      'Serbia': 'Europe/Belgrade',
      'Slovakia': 'Europe/Bratislava',
      'Slovenia': 'Europe/Ljubljana',
      'Vatican City': 'Europe/Vatican',
      'Kosovo': 'Europe/Belgrade',
      'Lebanon': 'Asia/Beirut',
      'Jordan': 'Asia/Amman',
      'Syria': 'Asia/Damascus',
      'Yemen': 'Asia/Aden',
      'Oman': 'Asia/Muscat',
      'Qatar': 'Asia/Qatar',
      'Bahrain': 'Asia/Bahrain',
      'Kuwait': 'Asia/Kuwait',
      'Palestine': 'Asia/Gaza',
    };

    return countryTimezoneMap[countryName] || 'UTC';
  };

  // Get all IANA timezones
  const getAllIANATimezones = (): string[] => {
    try {
      // Use Intl.supportedValuesOf if available (modern browsers)
      if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
        return Intl.supportedValuesOf('timeZone').sort();
      }
    } catch (e) {
      // Fallback if not supported
    }
    
    // Comprehensive fallback list of IANA timezones
    return [
      'Africa/Abidjan', 'Africa/Accra', 'Africa/Addis_Ababa', 'Africa/Algiers', 'Africa/Asmara',
      'Africa/Bamako', 'Africa/Bangui', 'Africa/Banjul', 'Africa/Bissau', 'Africa/Blantyre',
      'Africa/Brazzaville', 'Africa/Bujumbura', 'Africa/Cairo', 'Africa/Casablanca', 'Africa/Ceuta',
      'Africa/Conakry', 'Africa/Dakar', 'Africa/Dar_es_Salaam', 'Africa/Djibouti', 'Africa/Douala',
      'Africa/El_Aaiun', 'Africa/Freetown', 'Africa/Gaborone', 'Africa/Harare', 'Africa/Johannesburg',
      'Africa/Juba', 'Africa/Kampala', 'Africa/Khartoum', 'Africa/Kigali', 'Africa/Kinshasa',
      'Africa/Lagos', 'Africa/Libreville', 'Africa/Lome', 'Africa/Luanda', 'Africa/Lubumbashi',
      'Africa/Lusaka', 'Africa/Malabo', 'Africa/Maputo', 'Africa/Maseru', 'Africa/Mbabane',
      'Africa/Mogadishu', 'Africa/Monrovia', 'Africa/Nairobi', 'Africa/Ndjamena', 'Africa/Niamey',
      'Africa/Nouakchott', 'Africa/Ouagadougou', 'Africa/Porto-Novo', 'Africa/Sao_Tome', 'Africa/Tripoli',
      'Africa/Tunis', 'Africa/Windhoek', 'America/Adak', 'America/Anchorage', 'America/Anguilla',
      'America/Antigua', 'America/Araguaina', 'America/Argentina/Buenos_Aires', 'America/Argentina/Catamarca',
      'America/Argentina/Cordoba', 'America/Argentina/Jujuy', 'America/Argentina/La_Rioja', 'America/Argentina/Mendoza',
      'America/Argentina/Rio_Gallegos', 'America/Argentina/Salta', 'America/Argentina/San_Juan', 'America/Argentina/San_Luis',
      'America/Argentina/Tucuman', 'America/Argentina/Ushuaia', 'America/Aruba', 'America/Asuncion', 'America/Atikokan',
      'America/Bahia', 'America/Bahia_Banderas', 'America/Barbados', 'America/Belem', 'America/Belize',
      'America/Blanc-Sablon', 'America/Boa_Vista', 'America/Bogota', 'America/Boise', 'America/Cambridge_Bay',
      'America/Campo_Grande', 'America/Cancun', 'America/Caracas', 'America/Cayenne', 'America/Cayman',
      'America/Chicago', 'America/Chihuahua', 'America/Costa_Rica', 'America/Creston', 'America/Cuiaba',
      'America/Curacao', 'America/Danmarkshavn', 'America/Dawson', 'America/Dawson_Creek', 'America/Denver',
      'America/Detroit', 'America/Dominica', 'America/Edmonton', 'America/Eirunepe', 'America/El_Salvador',
      'America/Fort_Nelson', 'America/Fortaleza', 'America/Glace_Bay', 'America/Godthab', 'America/Goose_Bay',
      'America/Grand_Turk', 'America/Grenada', 'America/Guadeloupe', 'America/Guatemala', 'America/Guayaquil',
      'America/Guyana', 'America/Halifax', 'America/Havana', 'America/Hermosillo', 'America/Indiana/Indianapolis',
      'America/Indiana/Knox', 'America/Indiana/Marengo', 'America/Indiana/Petersburg', 'America/Indiana/Tell_City',
      'America/Indiana/Vevay', 'America/Indiana/Vincennes', 'America/Indiana/Winamac', 'America/Inuvik',
      'America/Iqaluit', 'America/Jamaica', 'America/Juneau', 'America/Kentucky/Louisville', 'America/Kentucky/Monticello',
      'America/Kralendijk', 'America/La_Paz', 'America/Lima', 'America/Los_Angeles', 'America/Lower_Princes',
      'America/Maceio', 'America/Managua', 'America/Manaus', 'America/Marigot', 'America/Martinique',
      'America/Matamoros', 'America/Mazatlan', 'America/Menominee', 'America/Merida', 'America/Metlakatla',
      'America/Mexico_City', 'America/Miquelon', 'America/Moncton', 'America/Monterrey', 'America/Montevideo',
      'America/Montserrat', 'America/Nassau', 'America/New_York', 'America/Nipigon', 'America/Nome',
      'America/Noronha', 'America/North_Dakota/Beulah', 'America/North_Dakota/Center', 'America/North_Dakota/New_Salem',
      'America/Nuuk', 'America/Ojinaga', 'America/Panama', 'America/Pangnirtung', 'America/Paramaribo',
      'America/Phoenix', 'America/Port-au-Prince', 'America/Port_of_Spain', 'America/Porto_Velho', 'America/Puerto_Rico',
      'America/Punta_Arenas', 'America/Rainy_River', 'America/Rankin_Inlet', 'America/Recife', 'America/Regina',
      'America/Resolute', 'America/Rio_Branco', 'America/Santarem', 'America/Santiago', 'America/Santo_Domingo',
      'America/Sao_Paulo', 'America/Scoresbysund', 'America/Sitka', 'America/St_Barthelemy', 'America/St_Johns',
      'America/St_Kitts', 'America/St_Lucia', 'America/St_Thomas', 'America/St_Vincent', 'America/Swift_Current',
      'America/Tegucigalpa', 'America/Thule', 'America/Thunder_Bay', 'America/Tijuana', 'America/Toronto',
      'America/Tortola', 'America/Vancouver', 'America/Whitehorse', 'America/Winnipeg', 'America/Yakutat',
      'America/Yellowknife', 'Antarctica/Casey', 'Antarctica/Davis', 'Antarctica/DumontDUrville', 'Antarctica/Macquarie',
      'Antarctica/Mawson', 'Antarctica/McMurdo', 'Antarctica/Palmer', 'Antarctica/Rothera', 'Antarctica/Syowa',
      'Antarctica/Troll', 'Antarctica/Vostok', 'Arctic/Longyearbyen', 'Asia/Aden', 'Asia/Almaty',
      'Asia/Amman', 'Asia/Anadyr', 'Asia/Aqtau', 'Asia/Aqtobe', 'Asia/Ashgabat', 'Asia/Atyrau', 'Asia/Baghdad',
      'Asia/Bahrain', 'Asia/Baku', 'Asia/Bangkok', 'Asia/Barnaul', 'Asia/Beirut', 'Asia/Bishkek', 'Asia/Brunei',
      'Asia/Chita', 'Asia/Choibalsan', 'Asia/Colombo', 'Asia/Damascus', 'Asia/Dhaka', 'Asia/Dili', 'Asia/Dubai',
      'Asia/Dushanbe', 'Asia/Famagusta', 'Asia/Gaza', 'Asia/Hebron', 'Asia/Ho_Chi_Minh', 'Asia/Hong_Kong',
      'Asia/Hovd', 'Asia/Irkutsk', 'Asia/Jakarta', 'Asia/Jayapura', 'Asia/Jerusalem', 'Asia/Kabul', 'Asia/Kamchatka',
      'Asia/Karachi', 'Asia/Kathmandu', 'Asia/Khandyga', 'Asia/Kolkata', 'Asia/Krasnoyarsk', 'Asia/Kuala_Lumpur',
      'Asia/Kuching', 'Asia/Kuwait', 'Asia/Macau', 'Asia/Magadan', 'Asia/Makassar', 'Asia/Manila', 'Asia/Muscat',
      'Asia/Nicosia', 'Asia/Novokuznetsk', 'Asia/Novosibirsk', 'Asia/Omsk', 'Asia/Oral', 'Asia/Phnom_Penh',
      'Asia/Pontianak', 'Asia/Pyongyang', 'Asia/Qatar', 'Asia/Qostanay', 'Asia/Qyzylorda', 'Asia/Riyadh',
      'Asia/Sakhalin', 'Asia/Samarkand', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Srednekolymsk',
      'Asia/Taipei', 'Asia/Tashkent', 'Asia/Tbilisi', 'Asia/Tehran', 'Asia/Thimphu', 'Asia/Tokyo', 'Asia/Tomsk',
      'Asia/Ulaanbaatar', 'Asia/Urumqi', 'Asia/Ust-Nera', 'Asia/Vientiane', 'Asia/Vladivostok', 'Asia/Yakutsk',
      'Asia/Yangon', 'Asia/Yekaterinburg', 'Asia/Yerevan', 'Atlantic/Azores', 'Atlantic/Bermuda', 'Atlantic/Canary',
      'Atlantic/Cape_Verde', 'Atlantic/Faroe', 'Atlantic/Madeira', 'Atlantic/Reykjavik', 'Atlantic/South_Georgia',
      'Atlantic/St_Helena', 'Atlantic/Stanley', 'Australia/Adelaide', 'Australia/Brisbane', 'Australia/Broken_Hill',
      'Australia/Darwin', 'Australia/Eucla', 'Australia/Hobart', 'Australia/Lindeman', 'Australia/Lord_Howe',
      'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney', 'Europe/Amsterdam', 'Europe/Andorra',
      'Europe/Astrakhan', 'Europe/Athens', 'Europe/Belgrade', 'Europe/Berlin', 'Europe/Bratislava', 'Europe/Brussels',
      'Europe/Bucharest', 'Europe/Budapest', 'Europe/Busingen', 'Europe/Chisinau', 'Europe/Copenhagen', 'Europe/Dublin',
      'Europe/Gibraltar', 'Europe/Guernsey', 'Europe/Helsinki', 'Europe/Isle_of_Man', 'Europe/Istanbul', 'Europe/Jersey',
      'Europe/Kaliningrad', 'Europe/Kiev', 'Europe/Kirov', 'Europe/Lisbon', 'Europe/Ljubljana', 'Europe/London',
      'Europe/Luxembourg', 'Europe/Madrid', 'Europe/Malta', 'Europe/Mariehamn', 'Europe/Minsk', 'Europe/Monaco',
      'Europe/Moscow', 'Europe/Oslo', 'Europe/Paris', 'Europe/Podgorica', 'Europe/Prague', 'Europe/Riga',
      'Europe/Rome', 'Europe/Samara', 'Europe/San_Marino', 'Europe/Sarajevo', 'Europe/Saratov', 'Europe/Simferopol',
      'Europe/Skopje', 'Europe/Sofia', 'Europe/Stockholm', 'Europe/Tallinn', 'Europe/Tirane', 'Europe/Ulyanovsk',
      'Europe/Uzhgorod', 'Europe/Vaduz', 'Europe/Vatican', 'Europe/Vienna', 'Europe/Vilnius', 'Europe/Volgograd',
      'Europe/Warsaw', 'Europe/Zagreb', 'Europe/Zaporozhye', 'Europe/Zurich', 'Indian/Antananarivo', 'Indian/Chagos',
      'Indian/Christmas', 'Indian/Cocos', 'Indian/Comoro', 'Indian/Kerguelen', 'Indian/Mahe', 'Indian/Maldives',
      'Indian/Mauritius', 'Indian/Mayotte', 'Indian/Reunion', 'Pacific/Apia', 'Pacific/Auckland', 'Pacific/Bougainville',
      'Pacific/Chatham', 'Pacific/Chuuk', 'Pacific/Easter', 'Pacific/Efate', 'Pacific/Enderbury', 'Pacific/Fakaofo',
      'Pacific/Fiji', 'Pacific/Funafuti', 'Pacific/Galapagos', 'Pacific/Gambier', 'Pacific/Guadalcanal', 'Pacific/Guam',
      'Pacific/Honolulu', 'Pacific/Kiritimati', 'Pacific/Kosrae', 'Pacific/Kwajalein', 'Pacific/Majuro', 'Pacific/Marquesas',
      'Pacific/Midway', 'Pacific/Nauru', 'Pacific/Niue', 'Pacific/Norfolk', 'Pacific/Noumea', 'Pacific/Pago_Pago',
      'Pacific/Palau', 'Pacific/Pitcairn', 'Pacific/Pohnpei', 'Pacific/Port_Moresby', 'Pacific/Rarotonga', 'Pacific/Saipan',
      'Pacific/Tahiti', 'Pacific/Tarawa', 'Pacific/Tongatapu', 'Pacific/Wake', 'Pacific/Wallis', 'UTC'
    ].sort();
  };

  // Load company data from database
  useEffect(() => {
    const loadCompanyData = async () => {
      if (!currentCompany?.id) {
        setCompanyLoading(false);
        return;
      }

      try {
        setCompanyLoading(true);
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', currentCompany.id)
          .single();

        if (error) throw error;

        if (data) {
          const formData: CompanyFormData = {
            companyName: data.name || '',
            industry: data.industry || '',
            address: data.address || '',
            city: data.city || '',
            country: data.country || '',
            phoneCountryCode: data.phone_country_code || '+1',
            phoneNumber: data.phone_number || '',
            email: data.email || '',
            website: data.website || '',
            logo: data.logo_url || null,
            timezone: data.timezone || 'UTC'
          };
          
          setCompanyData(formData);
          setOriginalCompanyData(formData);
        }
      } catch (err) {
        console.error('Error loading company data:', err);
      } finally {
        setCompanyLoading(false);
        setIsInitialLoad(false);
      }
    };

    loadCompanyData();
  }, [currentCompany?.id]);

  // Auto-select timezone when country changes (only after initial load)
  useEffect(() => {
    if (!isInitialLoad && companyData.country && companyData.country !== originalCompanyData.country) {
      const suggestedTimezone = getTimezoneForCountry(companyData.country);
      if (suggestedTimezone && suggestedTimezone !== companyData.timezone) {
        setCompanyData(prev => ({ ...prev, timezone: suggestedTimezone }));
      }
    }
  }, [companyData.country, isInitialLoad]);

  // Check for changes in company data
  useEffect(() => {
    const dataChanged = JSON.stringify(companyData) !== JSON.stringify(originalCompanyData);
    setHasChanges(dataChanged);
  }, [companyData, originalCompanyData]);

  // Check for changes in attendance settings
  useEffect(() => {
    const dataChanged = JSON.stringify(attendanceSettings) !== JSON.stringify(originalAttendanceSettings);
    setAttendanceSettingsHasChanges(dataChanged);
  }, [attendanceSettings, originalAttendanceSettings]);

  // Settings menu configuration
  const settingsMenu = [
    { id: 'company-info', label: 'Company', icon: Building },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
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

          const handleSaveCompany = async () => {
            if (!currentCompany?.id) return;
            
            // Validate phone number if provided
            if (companyData.phoneNumber.trim() && companyData.phoneCountryCode) {
              const validation = validatePhoneNumber(companyData.phoneNumber, companyData.phoneCountryCode);
              if (!validation.isValid) {
                setPhoneErrors({ phoneNumber: validation.error });
                return;
              }
            }
            
            setPhoneErrors({});
            
            try {
              // Prepare data for database
              // Note: additional profile fields (industry, city, phone, email, website, logo_url) require DB columns:
              // see `migration_add_company_profile_fields.sql`
              const updateData: any = {
                name: companyData.companyName.trim(),
                address: companyData.address.trim() || null,
                city: companyData.city.trim() || null,
                country: companyData.country || null,
                timezone: companyData.timezone || 'UTC',
                industry: companyData.industry || null,
                phone_country_code: companyData.phoneCountryCode || null,
                phone_number: companyData.phoneNumber.trim() || null,
                email: companyData.email.trim() || null,
                website: companyData.website.trim() || null,
                updated_at: new Date().toISOString(),
              };
              
              // logo_url (puede ser null para eliminar)
              updateData.logo_url = companyData.logo || null;
              
              console.log('Attempting to update company:', {
                companyId: currentCompany.id,
                updateData
              });
              
              // Update the company
              const { data: updateResult, error: updateError } = await supabase
                .from('companies')
                .update(updateData)
                .eq('id', currentCompany.id)
                .select();
              
              if (updateError) {
                console.error('Update error details:', updateError);
                throw updateError;
              }
              
              console.log('Update result:', updateResult);
              
              // Si la actualización fue exitosa pero no devolvió datos, intentar obtenerlos
              let data = updateResult?.[0];
              
              if (!data) {
                // Fetch the updated data
                const { data: fetchedData, error: fetchError } = await supabase
                  .from('companies')
                  .select('*')
                  .eq('id', currentCompany.id)
                  .maybeSingle();
                
                if (fetchError) {
                  console.warn('Could not fetch updated company data:', fetchError);
                } else {
                  data = fetchedData;
                }
              }
              
              // Update local state
              setOriginalCompanyData(companyData);
              setHasChanges(false);
              
              // Update company store with fetched data or merge with current
              if (data) {
                useCompanyStore.getState().setCurrentCompany(
                  { ...currentCompany, ...data },
                  useCompanyStore.getState().currentCompanyUser!
                );
                alert('Company information saved successfully!');
              } else {
                // If we couldn't fetch, at least update with what we know
                useCompanyStore.getState().setCurrentCompany(
                  { ...currentCompany, ...updateData },
                  useCompanyStore.getState().currentCompanyUser!
                );
                alert('Company information saved successfully! (Note: Could not verify update)');
              }
            } catch (err: any) {
              console.error('Error saving company data:', err);
              const errorMessage = err.message || 'Unknown error';
              const errorDetails = err.details ? `\n\nDetails: ${err.details}` : '';
              const errorHint = err.code === '42501' 
                ? '\n\nHint: You may not have permission to update this company. Check your RLS policies.'
                : '';
              alert(`Failed to save company information: ${errorMessage}${errorDetails}${errorHint}`);
            }
          };

          const handleCancelCompany = () => {
            setCompanyData(originalCompanyData);
            setHasChanges(false);
          };

      const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tipo de archivo
        const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'image/jpg'];
        if (!validTypes.includes(file.type.toLowerCase())) {
          alert('Please upload a valid image file (JPEG, PNG, SVG, or WebP)');
          return;
        }

        // Validar tamaño (2MB máximo)
        if (file.size > 2 * 1024 * 1024) {
          alert('File size must be less than 2MB');
          return;
        }

        setLogoUploading(true);

        try {
          if (!currentCompany?.id) {
            throw new Error('No company selected');
          }

          // Eliminar logo anterior si existe
          if (companyData.logo) {
            await handleDeleteLogo(false);
          }

          // Generar nombre único para el archivo
          const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 9);
          const fileName = `${currentCompany.id}/${timestamp}-${randomId}.${fileExt}`;

          console.log('Uploading logo:', { fileName, fileSize: file.size, fileType: file.type });

          // Subir el archivo al bucket
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('company-logos')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Upload failed: ${uploadError.message}`);
          }

          if (!uploadData?.path) {
            throw new Error('Upload succeeded but no file path returned');
          }

          // Obtener la URL pública
          const { data: urlData } = supabase.storage
            .from('company-logos')
            .getPublicUrl(uploadData.path);

          const publicUrl = urlData?.publicUrl;

          if (!publicUrl) {
            throw new Error('Failed to generate public URL');
          }

          console.log('Logo uploaded successfully:', {
            path: uploadData.path,
            publicUrl,
            bucket: 'company-logos'
          });

          // Verificar que la URL es accesible (hacer una petición HEAD)
          try {
            const response = await fetch(publicUrl, { method: 'HEAD' });
            if (!response.ok) {
              console.warn('Logo URL may not be accessible:', response.status, response.statusText);
              console.warn('Make sure the bucket is PUBLIC in Supabase Dashboard');
            }
          } catch (fetchError) {
            console.warn('Could not verify logo URL accessibility:', fetchError);
          }

          // Actualizar el estado
          setCompanyData(prev => ({ ...prev, logo: publicUrl }));
          setHasChanges(true);

        } catch (err: any) {
          console.error('Error uploading logo:', err);
          alert(`Failed to upload logo: ${err.message || 'Unknown error'}\n\nPlease check:\n1. Bucket 'company-logos' exists\n2. Bucket is set to PUBLIC\n3. RLS policies are configured`);
        } finally {
          setLogoUploading(false);
          // Limpiar el input
          e.target.value = '';
        }
      };

      const handleDeleteLogo = async (showAlert = true) => {
        if (!currentCompany?.id) return;

        try {
          // Si hay un logo en el estado, intentar eliminarlo del storage
          if (companyData.logo) {
            // Extraer el path del archivo de la URL
            const url = companyData.logo;
            let filePath = '';
            
            // Intentar extraer el path de diferentes formatos de URL
            if (url.includes('/storage/v1/object/public/company-logos/')) {
              filePath = url.split('/storage/v1/object/public/company-logos/')[1];
            } else if (url.includes('/company-logos/')) {
              const parts = url.split('/company-logos/');
              if (parts.length > 1) {
                filePath = parts[1].split('?')[0]; // Remover query params si existen
              }
            }

            if (filePath) {
              console.log('Deleting logo from storage:', filePath);
              const { error: deleteError } = await supabase.storage
                .from('company-logos')
                .remove([filePath]);

              if (deleteError) {
                console.warn('Error deleting logo from storage:', deleteError);
              } else {
                console.log('Logo deleted from storage successfully');
              }
            }
          }

          // Limpiar el campo logo en el estado
          setCompanyData(prev => ({ ...prev, logo: null }));
          setHasChanges(true);

          if (showAlert) {
            alert('Logo deleted. Click "Save Changes" to update the database.');
          }
        } catch (err: any) {
          console.error('Error deleting logo:', err);
          // Continuar de todas formas para limpiar el campo
          setCompanyData(prev => ({ ...prev, logo: null }));
          setHasChanges(true);
          if (showAlert) {
            alert('Logo removed from form. Click "Save Changes" to update the database.');
          }
        }
      };

      if (companyLoading) {
        return (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="text-center py-8 text-gray-500">Loading company information...</div>
          </div>
        );
      }

      return (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="space-y-8">
                {/* Company Logo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Company Logo
                    {logoUploading && <span className="text-sm text-blue-600 ml-2">(Uploading...)</span>}
                  </label>
                  <div className="flex items-start gap-6">
                    {/* Preview del logo */}
                    <div className="relative w-32 h-32 border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                      {logoUploading ? (
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                          <div className="text-xs text-gray-600">Uploading...</div>
                        </div>
                      ) : companyData.logo ? (
                        <>
                          <img 
                            src={companyData.logo} 
                            alt="Company logo" 
                            className="w-full h-full object-contain p-2" 
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.style.display = 'none';
                              const parent = img.parentElement;
                              if (parent && !parent.querySelector('.error-message')) {
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'error-message text-center p-2';
                                errorDiv.innerHTML = `
                                  <div class="text-red-600 text-xs font-medium mb-1">Image Error</div>
                                  <div class="text-gray-500 text-[10px] break-all">${companyData.logo.substring(0, 40)}...</div>
                                  <div class="text-gray-400 text-[10px] mt-1">Check bucket settings</div>
                                `;
                                parent.appendChild(errorDiv);
                              }
                            }}
                            onLoad={() => {
                              console.log('✅ Logo loaded successfully');
                            }}
                          />
                          <button
                            onClick={() => {
                              if (confirm('Delete this logo?')) {
                                handleDeleteLogo();
                              }
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-sm"
                            title="Delete logo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <div className="text-center text-gray-400">
                          <Building2 className="w-12 h-12 mx-auto mb-2" />
                          <div className="text-xs">No logo</div>
                        </div>
                      )}
                    </div>

                    {/* Controles */}
                    <div className="flex-1">
                      <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                          <input
                            type="file"
                            id="logo-upload"
                            accept="image/jpeg,image/png,image/svg+xml,image/webp,image/jpg"
                            onChange={handleLogoUpload}
                            disabled={logoUploading}
                            className="hidden"
                          />
                          <label
                            htmlFor="logo-upload"
                            className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors ${
                              logoUploading ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            <Upload className="w-4 h-4" />
                            {logoUploading ? 'Uploading...' : companyData.logo ? 'Replace Logo' : 'Upload Logo'}
                          </label>
                          {companyData.logo && !logoUploading && (
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete the company logo?')) {
                                  handleDeleteLogo();
                                }
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>Accepted formats: JPEG, PNG, SVG, WebP</p>
                          <p>Maximum size: 2MB</p>
                          {companyData.logo && (
                            <p className="text-blue-600 mt-2">
                              ✓ Logo uploaded. Click "Save Changes" to save.
                            </p>
                          )}
                        </div>
                      </div>
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

                  {/* Timezone Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Timezone <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={companyData.timezone}
                      onChange={(e) => handleCompanyChange('timezone', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      {getAllIANATimezones().map((tz) => (
                        <option key={tz} value={tz}>
                          {tz}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                      Timezone is stored in IANA format (e.g., America/New_York, Europe/London)
                    </p>
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
                        <div className="relative w-40">
                          <select
                            value={companyData.phoneCountryCode}
                            onChange={(e) => {
                              handleCompanyChange('phoneCountryCode', e.target.value);
                              setPhoneErrors({});
                            }}
                            className="w-full px-3 pr-8 h-10 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none bg-white text-transparent"
                          >
                            <option value="">Country code</option>
                            {phoneCountryCodeOptions.map((country) => (
                              <option key={country.iso} value={country.code}>
                                {country.iso} {country.flag} {country.code}
                              </option>
                            ))}
                          </select>
                          {/* Overlay que muestra solo bandera + código cuando está cerrado */}
                          {companyData.phoneCountryCode ? (
                            <div className="absolute inset-y-0 left-0 right-0 flex items-center px-3 pointer-events-none">
                              <span className="text-sm text-gray-900">
                                {getSelectedCountry(companyData.phoneCountryCode)?.flag} {companyData.phoneCountryCode}
                              </span>
                            </div>
                          ) : (
                            <div className="absolute inset-y-0 left-0 right-0 flex items-center px-3 pointer-events-none">
                              <span className="text-sm text-gray-500">Country code</span>
                            </div>
                          )}
                          <ChevronRight className="absolute right-2 top-1/2 transform -translate-y-1/2 rotate-90 w-4 h-4 text-gray-400 pointer-events-none" />
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

    if (activeSection === 'schedule') {
      const handleCreateSchedule = () => {
        setNewScheduleName('');
        setScheduleDays([
          { day_of_week: 0, day_name: 'Sunday', is_working: false, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
          { day_of_week: 1, day_name: 'Monday', is_working: true, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
          { day_of_week: 2, day_name: 'Tuesday', is_working: true, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
          { day_of_week: 3, day_name: 'Wednesday', is_working: true, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
          { day_of_week: 4, day_name: 'Thursday', is_working: true, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
          { day_of_week: 5, day_name: 'Friday', is_working: true, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
          { day_of_week: 6, day_name: 'Saturday', is_working: false, start_time: '09:00', end_time: '17:00', break_minutes: 60 },
        ]);
        setEditingSchedule(null);
        setShowCreateSchedule(true);
      };

      const handleEditSchedule = (schedule: any) => {
        setNewScheduleName(schedule.name);
        const days = schedule.fixed_schedule_days || [];
        const dayMap = new Map(days.map((d: any) => [d.day_of_week, d]));
        
        const getDayData = (dayOfWeek: number) => {
          const dayData = dayMap.get(dayOfWeek) as any;
          return {
            is_working: dayData?.is_working || false,
            start_time: dayData?.start_time || '09:00',
            end_time: dayData?.end_time || '17:00',
            break_minutes: dayData?.break_minutes || 60
          };
        };
        
        setScheduleDays([
          { day_of_week: 1, day_name: 'Monday', is_working: getDayData(1).is_working, start_time: getDayData(1).start_time, end_time: getDayData(1).end_time, break_minutes: getDayData(1).break_minutes },
          { day_of_week: 2, day_name: 'Tuesday', is_working: getDayData(2).is_working, start_time: getDayData(2).start_time, end_time: getDayData(2).end_time, break_minutes: getDayData(2).break_minutes },
          { day_of_week: 3, day_name: 'Wednesday', is_working: getDayData(3).is_working, start_time: getDayData(3).start_time, end_time: getDayData(3).end_time, break_minutes: getDayData(3).break_minutes },
          { day_of_week: 4, day_name: 'Thursday', is_working: getDayData(4).is_working, start_time: getDayData(4).start_time, end_time: getDayData(4).end_time, break_minutes: getDayData(4).break_minutes },
          { day_of_week: 5, day_name: 'Friday', is_working: getDayData(5).is_working, start_time: getDayData(5).start_time, end_time: getDayData(5).end_time, break_minutes: getDayData(5).break_minutes },
          { day_of_week: 6, day_name: 'Saturday', is_working: getDayData(6).is_working, start_time: getDayData(6).start_time, end_time: getDayData(6).end_time, break_minutes: getDayData(6).break_minutes },
          { day_of_week: 0, day_name: 'Sunday', is_working: getDayData(0).is_working, start_time: getDayData(0).start_time, end_time: getDayData(0).end_time, break_minutes: getDayData(0).break_minutes },
        ]);
        setEditingSchedule(schedule);
        setShowCreateSchedule(true);
      };

      const handleDeleteSchedule = async (scheduleId: string) => {
        if (!confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
          return;
        }

        try {
          const { error } = await supabase
            .from('fixed_schedules')
            .delete()
            .eq('id', scheduleId);

          if (error) throw error;

          setFixedSchedules(prev => prev.filter(s => s.id !== scheduleId));
        } catch (err: any) {
          console.error('Error deleting schedule:', err);
          alert(`Failed to delete schedule: ${err.message || 'Unknown error'}`);
        }
      };

      const handleSaveSchedule = async () => {
        if (!currentCompany?.id || !newScheduleName.trim()) {
          alert('Please enter a schedule name');
          return;
        }

        try {
          if (editingSchedule) {
            // Update existing schedule
            const { error: updateError } = await supabase
              .from('fixed_schedules')
              .update({ name: newScheduleName.trim() })
              .eq('id', editingSchedule.id);

            if (updateError) throw updateError;

            // Delete existing days
            const { error: deleteError } = await supabase
              .from('fixed_schedule_days')
              .delete()
              .eq('fixed_schedule_id', editingSchedule.id);

            if (deleteError) throw deleteError;

            // Insert new days
            const workingDays = scheduleDays.filter(d => d.is_working);
            if (workingDays.length > 0) {
              const { error: insertError } = await supabase
                .from('fixed_schedule_days')
                .insert(workingDays.map(d => ({
                  fixed_schedule_id: editingSchedule.id,
                  day_of_week: d.day_of_week,
                  is_working: true,
                  start_time: d.start_time,
                  end_time: d.end_time,
                  break_minutes: d.break_minutes
                })));

              if (insertError) throw insertError;
            }

            // Reload schedules
            const { data, error: reloadError } = await supabase
              .from('fixed_schedules')
              .select(`
                *,
                fixed_schedule_days (
                  id,
                  day_of_week,
                  is_working,
                  start_time,
                  end_time,
                  break_minutes
                )
              `)
              .eq('company_id', currentCompany.id)
              .order('created_at', { ascending: false });

            if (reloadError) throw reloadError;
            setFixedSchedules(data || []);
          } else {
            // Create new schedule
            const { data: newSchedule, error: createError } = await supabase
              .from('fixed_schedules')
              .insert({
                company_id: currentCompany.id,
                name: newScheduleName.trim(),
                timezone: 'UTC'
              })
              .select()
              .single();

            if (createError) throw createError;

            // Insert days
            const workingDays = scheduleDays.filter(d => d.is_working);
            if (workingDays.length > 0) {
              const { error: insertError } = await supabase
                .from('fixed_schedule_days')
                .insert(workingDays.map(d => ({
                  fixed_schedule_id: newSchedule.id,
                  day_of_week: d.day_of_week,
                  is_working: true,
                  start_time: d.start_time,
                  end_time: d.end_time,
                  break_minutes: d.break_minutes
                })));

              if (insertError) throw insertError;
            }

            // Reload schedules
            const { data, error: reloadError } = await supabase
              .from('fixed_schedules')
              .select(`
                *,
                fixed_schedule_days (
                  id,
                  day_of_week,
                  is_working,
                  start_time,
                  end_time,
                  break_minutes
                )
              `)
              .eq('company_id', currentCompany.id)
              .order('created_at', { ascending: false });

            if (reloadError) throw reloadError;
            setFixedSchedules(data || []);
          }

          setShowCreateSchedule(false);
          setEditingSchedule(null);
          setNewScheduleName('');
        } catch (err: any) {
          console.error('Error saving schedule:', err);
          alert(`Failed to save schedule: ${err.message || 'Unknown error'}`);
        }
      };

      const formatTime = (time: string) => {
        if (!time) return '--';
        return time.slice(0, 5); // HH:MM
      };

      const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours === 0) return `${mins}m`;
        if (mins === 0) return `${hours}h`;
        return `${hours}h ${mins}m`;
      };

      return (
        <div className="space-y-6">
          {/* Fixed Schedules List */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Fixed Schedules</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Create reusable schedule templates that can be assigned to multiple workers.
                </p>
              </div>
              <button
                onClick={handleCreateSchedule}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Fixed Schedule
              </button>
            </div>

            {fixedSchedulesLoading ? (
              <div className="text-center py-8 text-gray-500">Loading schedules...</div>
            ) : fixedSchedules.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p>No fixed schedules created yet.</p>
                <p className="text-sm text-gray-400 mt-1">Create your first schedule template to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {fixedSchedules.map((schedule) => {
                  const days = schedule.fixed_schedule_days || [];
                  // Order: Monday (1) to Sunday (0)
                  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
                  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                  
                  return (
                    <div key={schedule.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-base font-medium text-gray-900">{schedule.name}</h4>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditSchedule(schedule)}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title="Edit schedule"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            title="Delete schedule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-7 gap-2 text-xs">
                        {dayOrder.map((dayOfWeek, index) => {
                          const dayData = days.find((d: any) => d.day_of_week === dayOfWeek);
                          const isWorking = dayData?.is_working || false;
                          const dayName = dayNames[index] || '';
                          
                          return (
                            <div key={dayOfWeek} className={`p-2 rounded ${isWorking ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                              <div className="font-medium text-gray-700 mb-1">{dayName.slice(0, 3)}</div>
                              {isWorking ? (
                                <>
                                  <div className="text-gray-900">{formatTime(dayData.start_time)} - {formatTime(dayData.end_time)}</div>
                                  {dayData.break_minutes > 0 && (
                                    <div className="text-gray-600 mt-1">Break: {formatDuration(dayData.break_minutes)}</div>
                                  )}
                                </>
                              ) : (
                                <div className="text-gray-500">Off</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create/Edit Schedule Modal */}
          {showCreateSchedule && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingSchedule ? 'Edit Fixed Schedule' : 'Create Fixed Schedule'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateSchedule(false);
                    setEditingSchedule(null);
                    setNewScheduleName('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Schedule Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newScheduleName}
                    onChange={(e) => setNewScheduleName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="e.g., Regular 9-5, Night Shift"
                  />
                </div>

                {/* Schedule Days */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Working Days</label>
                  <div className="space-y-3">
                    {scheduleDays.map((day) => (
                      <div key={day.day_of_week} className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3 w-32">
                          <input
                            type="checkbox"
                            checked={day.is_working}
                            onChange={(e) => {
                              setScheduleDays(prev => prev.map(d => 
                                d.day_of_week === day.day_of_week 
                                  ? { ...d, is_working: e.target.checked }
                                  : d
                              ));
                            }}
                            className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                          />
                          <span className="text-sm font-medium text-gray-700 w-20">{day.day_name}</span>
                        </div>
                        
                        {day.is_working && (
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-600">Start:</label>
                              <input
                                type="time"
                                value={day.start_time}
                                onChange={(e) => {
                                  setScheduleDays(prev => prev.map(d => 
                                    d.day_of_week === day.day_of_week 
                                      ? { ...d, start_time: e.target.value }
                                      : d
                                  ));
                                }}
                                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-600">End:</label>
                              <input
                                type="time"
                                value={day.end_time}
                                onChange={(e) => {
                                  setScheduleDays(prev => prev.map(d => 
                                    d.day_of_week === day.day_of_week 
                                      ? { ...d, end_time: e.target.value }
                                      : d
                                  ));
                                }}
                                className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-600">Break:</label>
                              <input
                                type="number"
                                min="0"
                                max="480"
                                value={day.break_minutes}
                                onChange={(e) => {
                                  setScheduleDays(prev => prev.map(d => 
                                    d.day_of_week === day.day_of_week 
                                      ? { ...d, break_minutes: parseInt(e.target.value) || 0 }
                                      : d
                                  ));
                                }}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="60"
                              />
                              <span className="text-xs text-gray-500">min</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleSaveSchedule}
                    disabled={!newScheduleName.trim()}
                    className={`px-6 py-2 rounded-md font-medium transition-colors ${
                      newScheduleName.trim()
                        ? 'bg-primary text-white hover:bg-primary/90'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateSchedule(false);
                      setEditingSchedule(null);
                      setNewScheduleName('');
                    }}
                    className="px-6 py-2 rounded-md font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeSection === 'time-and-attendance') {
      const handleAttendanceSettingChange = (
        field: 'late_tolerance_minutes' | 'early_leave_tolerance_minutes' | 'early_arrival_tolerance_minutes' | 'late_departure_tolerance_minutes', 
        value: number
      ) => {
        setAttendanceSettings(prev => ({ ...prev, [field]: value }));
      };

      const handleOvertimeModeChange = (value: 'daily_total' | 'per_shift') => {
        setAttendanceSettings(prev => ({ ...prev, overtime_calculation_mode: value }));
      };

      const handleSaveAttendanceSettings = async () => {
        if (!currentCompany?.id) return;

        try {
          const { error } = await supabase
            .from('company_attendance_settings')
            .upsert({
              company_id: currentCompany.id,
              late_tolerance_minutes: attendanceSettings.late_tolerance_minutes,
              early_leave_tolerance_minutes: attendanceSettings.early_leave_tolerance_minutes,
              early_arrival_tolerance_minutes: attendanceSettings.early_arrival_tolerance_minutes,
              late_departure_tolerance_minutes: attendanceSettings.late_departure_tolerance_minutes,
              overtime_calculation_mode: attendanceSettings.overtime_calculation_mode
            }, {
              onConflict: 'company_id'
            });

          if (error) throw error;

          setOriginalAttendanceSettings(attendanceSettings);
          setAttendanceSettingsHasChanges(false);
        } catch (err: any) {
          console.error('Error saving attendance settings:', err);
          alert(`Failed to save attendance settings: ${err.message || 'Unknown error'}`);
        }
      };

      const handleCancelAttendanceSettings = () => {
        setAttendanceSettings(originalAttendanceSettings);
        setAttendanceSettingsHasChanges(false);
      };

      return (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">Tolerance Settings</h3>
              <p className="text-sm text-gray-600 mb-6">
                Configure the tolerance minutes for arrivals and departures. These settings determine when attendance flags are triggered.
              </p>

              <div className="space-y-6">
                {/* Early Arrival Tolerance */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Early Arrival Tolerance (minutes)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={attendanceSettings.early_arrival_tolerance_minutes}
                      onChange={(e) => handleAttendanceSettingChange('early_arrival_tolerance_minutes', parseInt(e.target.value) || 0)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="0"
                    />
                    <p className="text-sm text-gray-500">
                      Workers arriving within this many minutes before their scheduled start time will not be flagged as early arrival.
                    </p>
                  </div>
                </div>

                {/* Late Arrival Tolerance */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Late Arrival Tolerance (minutes)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={attendanceSettings.late_tolerance_minutes}
                      onChange={(e) => handleAttendanceSettingChange('late_tolerance_minutes', parseInt(e.target.value) || 0)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="5"
                    />
                    <p className="text-sm text-gray-500">
                      Workers arriving within this many minutes after their scheduled start time will not be flagged as late.
                    </p>
                  </div>
                </div>

                {/* Early Departure Tolerance */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Early Departure Tolerance (minutes)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={attendanceSettings.early_leave_tolerance_minutes}
                      onChange={(e) => handleAttendanceSettingChange('early_leave_tolerance_minutes', parseInt(e.target.value) || 0)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="5"
                    />
                    <p className="text-sm text-gray-500">
                      Workers leaving within this many minutes before their scheduled end time will not be flagged as early departure.
                    </p>
                  </div>
                </div>

                {/* Late Departure Tolerance */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Late Departure Tolerance (minutes)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={attendanceSettings.late_departure_tolerance_minutes}
                      onChange={(e) => handleAttendanceSettingChange('late_departure_tolerance_minutes', parseInt(e.target.value) || 0)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="0"
                    />
                    <p className="text-sm text-gray-500">
                      Workers leaving within this many minutes after their scheduled end time will not be flagged as late departure.
                    </p>
                  </div>
                </div>

                {/* Overtime Calculation Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Overtime Calculation Mode
                  </label>
                  <div className="flex items-center gap-4">
                    <select
                      value={attendanceSettings.overtime_calculation_mode}
                      onChange={(e) => handleOvertimeModeChange(e.target.value as 'daily_total' | 'per_shift')}
                      className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="daily_total">Daily Total</option>
                      <option value="per_shift">Per Shift</option>
                    </select>
                    <p className="text-sm text-gray-500">
                      {attendanceSettings.overtime_calculation_mode === 'daily_total' 
                        ? 'Overtime is calculated based on the total hours worked in a day.'
                        : 'Overtime is calculated separately for each shift worked in a day.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleSaveAttendanceSettings}
                disabled={!attendanceSettingsHasChanges || attendanceSettingsLoading}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  attendanceSettingsHasChanges && !attendanceSettingsLoading
                    ? 'bg-primary text-white hover:bg-primary/90'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Save Changes
              </button>
              <button
                onClick={handleCancelAttendanceSettings}
                disabled={!attendanceSettingsHasChanges}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  attendanceSettingsHasChanges
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
            <span className="text-sm font-medium text-gray-900">{currentCompany?.name || 'Company'}</span>
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
