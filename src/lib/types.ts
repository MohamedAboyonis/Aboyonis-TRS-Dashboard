// Core data model. Every record carries an `id`; the whole dataset belongs to one company (tenant).
// The same shapes are mirrored in supabase/schema.sql for the cloud/multi-device backend.

export type ISODate = string; // YYYY-MM-DD

export interface Company {
  name: string;
  legalName?: string;
  logo?: string; // data URL
  primaryColor: string;
  country?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency: string;
  licenseKey?: string;
  // Configurable drop-down lists so the app fits any TRS company
  lists: {
    customers: string[];
    serviceTypes: string[];
    toolTypes: string[];
    sizes: string[];
    nptCategories: string[];
    positions: string[];
    equipmentTypes: string[];
  };
}

export type Department = 'Operations' | 'Field' | 'Workshop' | 'HSE' | 'Training' | 'Management' | 'Admin';

export interface Employee {
  id: string;
  empNo: string; // company ID number
  name: string;
  position: string;
  department: Department;
  phone?: string;
  email?: string;
  nationalId?: string; // Iqama / national ID
  passportNo?: string;
  photo?: string;
  active: boolean;
  joinDate?: ISODate;
  // Login (optional — only staff who use the app need one)
  username?: string;
  pin?: string;
  roleId?: string;
  extraPermissions?: Permission[]; // special people can get extra tasks on top of their role
}

export type Permission =
  | 'dashboard.view'
  | 'ops.view'
  | 'ops.manage'
  | 'field.register'
  | 'timesheet.viewAll'
  | 'timesheet.manage'
  | 'leave.approve'
  | 'workshop.view'
  | 'workshop.manage'
  | 'hse.view'
  | 'hse.manage'
  | 'equipment.view'
  | 'equipment.manage'
  | 'employees.view'
  | 'employees.manage'
  | 'admin.company'
  | 'admin.access'
  | 'admin.license'
  | 'admin.data';

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  system?: boolean;
}

export type RigStatus = 'Operating' | 'Rig Move' | 'Standby' | 'Stacked';

export interface RigOperation {
  id: string;
  description: string;
  jobId?: string;
  plannedDate?: ISODate;
  startedAt?: ISODate;
  endedAt?: ISODate;
  notes?: string;
}

export interface Rig {
  id: string;
  name: string;
  customer?: string;
  field?: string;
  well?: string;
  status: RigStatus;
  current?: RigOperation;
  next: RigOperation[];
  history: RigOperation[];
  updatedAt?: string;
  updatedBy?: string;
}

export type JobStatus = 'Planned' | 'In Progress' | 'Completed' | 'Cancelled';

export interface Job {
  id: string;
  jobNo: string;
  rigId?: string;
  customer?: string;
  well?: string;
  serviceType?: string;
  toolType?: string;
  sizes: string[];
  startDate: ISODate;
  endDate?: ISODate;
  status: JobStatus;
  revenue?: number;
  hours?: number;
  joints?: number;
  nptHours?: number;
  nptCategory?: string;
  notes?: string;
}

export interface CrewAssignment {
  id: string;
  jobId: string;
  employeeId: string;
  crewRole?: string;
  startDate: ISODate;
  endDate?: ISODate; // open = still on the job
  registeredBy?: string;
  createdAt: string;
}

export type LeaveType = 'Vacation' | 'Sick Leave' | 'Emergency Leave' | 'Unpaid Leave';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface Leave {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: ISODate;
  endDate: ISODate;
  status: LeaveStatus;
  note?: string;
  fileId?: string; // e.g. sick note
  decidedBy?: string;
  createdAt: string;
}

export type DayCode = 'J' | 'W' | 'S' | 'T' | 'SB' | 'OF' | 'A' | 'V' | 'SL' | 'EL' | 'UL' | 'O' | 'X';

export interface TimesheetOverride {
  id: string;
  employeeId: string;
  date: ISODate;
  code: DayCode; // 'X' = removed (blank the day even if a job/leave exists)
  note?: string;
  by?: string;
  at: string;
}

export type PrepStatus = 'Requested' | 'In Preparation' | 'Ready' | 'Dispatched' | 'Returned';

export interface PrepSize {
  size: string;
  connection?: string;
  weight?: string;
  qty?: number;
}

export interface WorkshopPrep {
  id: string;
  jobNo: string;
  jobId?: string;
  rigId?: string;
  sizes: PrepSize[];
  equipmentIds: string[];
  assignedTo: string[]; // employee ids
  requiredDate?: ISODate;
  status: PrepStatus;
  checklist: { text: string; done: boolean }[];
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export type CertCategory = 'HSE' | 'Technical' | 'Identification';

export interface Certificate {
  id: string;
  employeeId: string;
  category: CertCategory;
  name: string;
  number?: string;
  issuer?: string;
  issueDate?: ISODate;
  expiryDate?: ISODate;
  fileId?: string;
}

export interface TrainingRequirement {
  id: string;
  position: string; // '*' = everyone
  certName: string;
  category: CertCategory;
}

export type EquipmentStatus = 'Available' | 'On Job' | 'In Maintenance' | 'Quarantine' | 'Retired';

export interface Equipment {
  id: string;
  assetNo: string;
  name: string;
  type: string;
  serialNo?: string;
  size?: string;
  manufacturer?: string;
  model?: string;
  location?: string;
  status: EquipmentStatus;
  maintIntervalDays?: number;
  notes?: string;
}

export type MaintType = 'Preventive' | 'Corrective' | 'Inspection' | 'Load Test' | 'NDT' | 'Calibration';

export interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  date: ISODate;
  type: MaintType;
  description: string;
  performedBy?: string;
  cost?: number;
  nextDue?: ISODate;
  fileId?: string;
}

export type EquipDocKind = 'Certificate' | 'COC' | 'Inspection Report' | 'Load Test' | 'NDT Report' | 'Manual';

export interface EquipmentDoc {
  id: string;
  equipmentId: string;
  kind: EquipDocKind;
  number?: string;
  issuer?: string;
  issueDate?: ISODate;
  expiryDate?: ISODate;
  fileId?: string;
}

export type HseEventType = 'Observation' | 'Near Miss' | 'First Aid' | 'Recordable' | 'Toolbox Talk' | 'Drill';

export interface HseEvent {
  id: string;
  type: HseEventType;
  date: ISODate;
  rigId?: string;
  jobId?: string;
  description: string;
  action?: string;
  status: 'Open' | 'Closed';
  reportedBy?: string;
  fileId?: string;
}

export interface AuditEntry {
  at: string;
  by?: string;
  action: string;
}

export interface AppData {
  version: number;
  company: Company | null;
  roles: Role[];
  employees: Employee[];
  rigs: Rig[];
  jobs: Job[];
  assignments: CrewAssignment[];
  leaves: Leave[];
  overrides: TimesheetOverride[];
  preps: WorkshopPrep[];
  certificates: Certificate[];
  trainingReqs: TrainingRequirement[];
  equipment: Equipment[];
  maintenance: MaintenanceRecord[];
  equipmentDocs: EquipmentDoc[];
  hseEvents: HseEvent[];
  audit: AuditEntry[];
}

export type Collection = Exclude<keyof AppData, 'version' | 'company' | 'audit'>;

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}
