import type { AppData, Company, Employee, Job, Rig } from './types';
import { emptyData, uid, nowIso } from './store';
import { addDays, today } from './dates';
import demoLog from './demoLog.json';

export function defaultLists(): Company['lists'] {
  return {
    customers: ['Customer A', 'Customer B', 'Customer C', 'Customer D', 'Customer E'],
    serviceTypes: ['Casing', 'Tubing', 'CDS', 'Combo', 'PULD', 'Liner', 'Completion'],
    toolTypes: ['Power Tong', 'Manual Tong', 'CDS System', 'PULD Tool', 'Running Tool', 'Bucking Unit'],
    sizes: ['2 3/8"', '2 7/8"', '3 1/2"', '4 1/2"', '5"', '5 1/2"', '7"', '9 5/8"', '10 3/4"', '13 3/8"', '18 5/8"', '20"'],
    nptCategories: ['Equipment', 'Process', 'Personnel', 'Client/3rd'],
    positions: ['Operations Manager', 'Operations Coordinator', 'Field Supervisor', 'Tong Operator', 'CRT Operator', 'Field Helper', 'Workshop Supervisor', 'Mechanic', 'Electrician', 'HSE Officer', 'Training Coordinator'],
    equipmentTypes: ['Power Tong', 'Back-up Tong', 'Casing Running Tool (CRT)', 'Elevator', 'Slip / Spider', 'Hydraulic Power Unit', 'Torque Turn System', 'Load Cell', 'Bucking Unit', 'Fill-up Tool'],
  };
}

const SIZE_MAP: Record<string, string> = { '4.5': '4 1/2"', '5.5': '5 1/2"', '7': '7"', '9.625': '9 5/8"', '13.375': '13 3/8"' };
const sz = (n: number) => SIZE_MAP[String(n)] ?? `${n}"`;

/** Demo dataset: historical jobs imported from "TRS_Operation Full Dashboard.xlsx" + live sample operations. */
export function demoData(company: Company, admin: Employee): AppData {
  const d = emptyData();
  d.company = company;
  const t = today();

  const rigs: Rig[] = ['RIG-01', 'RIG-02', 'RIG-03', 'RIG-04', 'RIG-05', 'RIG-06'].map((name, i) => ({
    id: `rig-${i + 1}`,
    name,
    customer: company.lists.customers[i % company.lists.customers.length],
    field: ['Ghawar', 'Abqaiq', 'Khurais', 'Shaybah', 'Safaniya', 'Manifa'][i],
    status: i === 4 ? 'Rig Move' : i === 5 ? 'Standby' : 'Operating',
    next: [],
    history: [],
    updatedAt: nowIso(),
  }));

  // Historical jobs from the Excel daily log
  const jobs: Job[] = (demoLog as (string | number | null)[][]).map((r, i) => {
    const [date, cust, rig, well, service, tool, size, revenue, hours, joints, npt, nptCat] = r;
    return {
      id: `job-h${i + 1}`,
      jobNo: `J-26${String(i + 1).padStart(4, '0')}`,
      rigId: rigs.find((x) => x.name === rig)?.id,
      customer: `Customer ${cust}`,
      well: String(well),
      serviceType: String(service),
      toolType: String(tool),
      sizes: [sz(Number(size))],
      startDate: String(date),
      endDate: String(date),
      status: 'Completed',
      revenue: Number(revenue),
      hours: Number(hours),
      joints: Number(joints),
      nptHours: Number(npt ?? 0),
      nptCategory: nptCat ? String(nptCat) : undefined,
    };
  });

  // Employees
  const people: [string, string, Employee['department'], string][] = [
    ['Ahmed Al-Harbi', 'Operations Coordinator', 'Operations', 'role-ops'],
    ['Khalid Al-Qahtani', 'Field Supervisor', 'Field', 'role-field'],
    ['Omar Hassan', 'Tong Operator', 'Field', 'role-field'],
    ['Yousef Al-Dossary', 'CRT Operator', 'Field', 'role-field'],
    ['Mahmoud Saleh', 'Tong Operator', 'Field', 'role-field'],
    ['Faisal Al-Mutairi', 'Field Helper', 'Field', 'role-field'],
    ['Rami Nasser', 'Field Helper', 'Field', 'role-field'],
    ['Tariq Al-Shehri', 'Workshop Supervisor', 'Workshop', 'role-workshop'],
    ['Sami Ibrahim', 'Mechanic', 'Workshop', 'role-workshop'],
    ['Nora Al-Zahrani', 'HSE Officer', 'HSE', 'role-hse'],
  ];
  const employees: Employee[] = [
    admin,
    ...people.map(([name, position, department, roleId], i) => ({
      id: `emp-${i + 1}`,
      empNo: `E${String(1001 + i)}`,
      name,
      position,
      department,
      roleId,
      username: name.split(' ')[0].toLowerCase(),
      pin: '1234',
      nationalId: `2${String(345678901 + i * 7919).slice(0, 9)}`,
      active: true,
      joinDate: '2023-01-15',
    })),
  ];

  // Live jobs around today, crews registered
  const live: Job[] = [
    { id: 'job-l1', jobNo: 'J-260901', rigId: 'rig-1', customer: rigs[0].customer, well: 'W-901', serviceType: 'Casing', toolType: 'CDS System', sizes: ['9 5/8"', '7"'], startDate: addDays(t, -4), status: 'In Progress' },
    { id: 'job-l2', jobNo: 'J-260902', rigId: 'rig-2', customer: rigs[1].customer, well: 'W-412', serviceType: 'Tubing', toolType: 'Power Tong', sizes: ['4 1/2"'], startDate: addDays(t, -2), status: 'In Progress' },
    { id: 'job-l3', jobNo: 'J-260903', rigId: 'rig-3', customer: rigs[2].customer, well: 'W-077', serviceType: 'Liner', toolType: 'Running Tool', sizes: ['7"'], startDate: addDays(t, -1), status: 'In Progress' },
    { id: 'job-l4', jobNo: 'J-260904', rigId: 'rig-4', customer: rigs[3].customer, well: 'W-560', serviceType: 'Casing', toolType: 'Power Tong', sizes: ['13 3/8"'], startDate: addDays(t, 2), status: 'Planned' },
    { id: 'job-l5', jobNo: 'J-260905', rigId: 'rig-5', customer: rigs[4].customer, well: 'W-233', serviceType: 'Combo', toolType: 'PULD Tool', sizes: ['5 1/2"', '4 1/2"'], startDate: addDays(t, 5), status: 'Planned' },
  ];
  jobs.push(...live);

  rigs[0].current = { id: uid('op'), description: 'Running 9 5/8" casing with CDS', jobId: 'job-l1', startedAt: addDays(t, -4) };
  rigs[0].next = [{ id: uid('op'), description: '7" liner run', plannedDate: addDays(t, 3) }];
  rigs[1].current = { id: uid('op'), description: 'Running 4 1/2" completion tubing', jobId: 'job-l2', startedAt: addDays(t, -2) };
  rigs[2].current = { id: uid('op'), description: '7" liner on running tool', jobId: 'job-l3', startedAt: addDays(t, -1) };
  rigs[2].next = [{ id: uid('op'), description: 'Tubing job after completion', plannedDate: addDays(t, 6) }];
  rigs[3].current = { id: uid('op'), description: 'Drilling 16" section (no TRS on location)', startedAt: addDays(t, -6) };
  rigs[3].next = [{ id: uid('op'), description: '13 3/8" casing run', jobId: 'job-l4', plannedDate: addDays(t, 2) }];
  rigs[4].current = { id: uid('op'), description: 'Rig move to W-233', startedAt: addDays(t, -1) };
  rigs[4].next = [{ id: uid('op'), description: 'Combo 5 1/2" x 4 1/2" PULD', jobId: 'job-l5', plannedDate: addDays(t, 5) }];

  d.assignments = [
    ['job-l1', 'emp-2', 'Supervisor', -4], ['job-l1', 'emp-4', 'CRT Operator', -4], ['job-l1', 'emp-6', 'Helper', -4],
    ['job-l2', 'emp-3', 'Tong Operator', -2], ['job-l2', 'emp-7', 'Helper', -2],
    ['job-l3', 'emp-5', 'Tong Operator', -1],
  ].map(([jobId, employeeId, crewRole, off]) => ({
    id: uid('as'), jobId: String(jobId), employeeId: String(employeeId), crewRole: String(crewRole), startDate: addDays(t, Number(off)), createdAt: nowIso(),
  }));
  d.leaves = [
    { id: uid('lv'), employeeId: 'emp-3', type: 'Vacation', startDate: addDays(t, -14), endDate: addDays(t, -8), status: 'Approved', createdAt: nowIso() },
    { id: uid('lv'), employeeId: 'emp-6', type: 'Sick Leave', startDate: addDays(t, -7), endDate: addDays(t, -6), status: 'Approved', createdAt: nowIso() },
    { id: uid('lv'), employeeId: 'emp-5', type: 'Vacation', startDate: addDays(t, 10), endDate: addDays(t, 24), status: 'Pending', createdAt: nowIso() },
  ];
  d.overrides = [
    { id: uid('ov'), employeeId: 'emp-5', date: addDays(t, -3), code: 'S', note: 'Monthly safety stand-down', at: nowIso() },
    { id: uid('ov'), employeeId: 'emp-7', date: addDays(t, -5), code: 'W', note: 'Tong service', at: nowIso() },
    { id: uid('ov'), employeeId: 'emp-6', date: addDays(t, -9), code: 'A', at: nowIso() },
  ];

  // Equipment & maintenance
  d.equipment = [
    ['PT-001', 'Power Tong 14"', 'Power Tong', '13 3/8"', 'Workshop', 'Available', 90],
    ['PT-002', 'Power Tong 7 5/8"', 'Power Tong', '7"', 'RIG-02', 'On Job', 90],
    ['CRT-001', 'CRT 500T', 'Casing Running Tool (CRT)', '9 5/8"', 'RIG-01', 'On Job', 180],
    ['HPU-001', 'Hydraulic Power Unit', 'Hydraulic Power Unit', '', 'RIG-01', 'On Job', 60],
    ['ELV-004', 'Side Door Elevator 350T', 'Elevator', '9 5/8"', 'Workshop', 'In Maintenance', 180],
    ['TT-001', 'Torque Turn System', 'Torque Turn System', '', 'Workshop', 'Available', 365],
  ].map(([assetNo, name, type, size, location, status, maint], i) => ({
    id: `eq-${i + 1}`, assetNo: String(assetNo), name: String(name), type: String(type), size: String(size) || undefined,
    serialNo: `SN-${48210 + i * 37}`, manufacturer: ['Weatherford-style', 'Generic', 'OEM'][i % 3], location: String(location),
    status: status as AppData['equipment'][number]['status'], maintIntervalDays: Number(maint),
  }));
  d.maintenance = [
    { id: uid('mt'), equipmentId: 'eq-1', date: addDays(t, -80), type: 'Preventive', description: '90-day PM: jaws, dies, hydraulic hoses', performedBy: 'Sami Ibrahim', nextDue: addDays(t, 10) },
    { id: uid('mt'), equipmentId: 'eq-3', date: addDays(t, -200), type: 'Inspection', description: 'Category III inspection', performedBy: 'Third party', nextDue: addDays(t, -20) },
    { id: uid('mt'), equipmentId: 'eq-5', date: addDays(t, -2), type: 'Corrective', description: 'Latch spring replaced, awaiting NDT', performedBy: 'Tariq Al-Shehri', nextDue: addDays(t, 3) },
    { id: uid('mt'), equipmentId: 'eq-4', date: addDays(t, -30), type: 'Preventive', description: 'Filter & oil change', performedBy: 'Sami Ibrahim', nextDue: addDays(t, 30) },
  ];
  d.equipmentDocs = [
    { id: uid('ed'), equipmentId: 'eq-3', kind: 'COC', number: 'COC-77812', issuer: 'Manufacturer', issueDate: '2024-03-01' },
    { id: uid('ed'), equipmentId: 'eq-3', kind: 'Load Test', number: 'LT-2209', issuer: 'Third party', issueDate: addDays(t, -340), expiryDate: addDays(t, 25) },
    { id: uid('ed'), equipmentId: 'eq-5', kind: 'NDT Report', number: 'NDT-551', issueDate: addDays(t, -400), expiryDate: addDays(t, -35) },
  ];

  // Training & HSE
  d.trainingReqs = [
    { id: uid('tr'), position: '*', certName: 'H2S Awareness', category: 'HSE' },
    { id: uid('tr'), position: '*', certName: 'First Aid / CPR', category: 'HSE' },
    { id: uid('tr'), position: 'Field Supervisor', certName: 'IWCF / Well Control', category: 'Technical' },
    { id: uid('tr'), position: 'Tong Operator', certName: 'Power Tong Operation', category: 'Technical' },
    { id: uid('tr'), position: 'CRT Operator', certName: 'CRT Operation', category: 'Technical' },
  ];
  d.certificates = [];
  employees.slice(1).forEach((e, i) => {
    d.certificates.push({ id: uid('ct'), employeeId: e.id, category: 'Identification', name: 'Iqama / National ID', number: e.nationalId, expiryDate: addDays(t, 200 + i * 30) });
    d.certificates.push({ id: uid('ct'), employeeId: e.id, category: 'HSE', name: 'H2S Awareness', issuer: 'Training Center', issueDate: addDays(t, -700 + i * 20), expiryDate: addDays(t, 30 + i * 20 - 60) });
    if (i % 3 !== 2) d.certificates.push({ id: uid('ct'), employeeId: e.id, category: 'HSE', name: 'First Aid / CPR', issuer: 'Red Crescent', expiryDate: addDays(t, 300 - i * 15) });
  });
  d.certificates.push({ id: uid('ct'), employeeId: 'emp-3', category: 'Technical', name: 'Power Tong Operation', issuer: 'In-house', expiryDate: addDays(t, 400) });
  d.certificates.push({ id: uid('ct'), employeeId: 'emp-4', category: 'Technical', name: 'CRT Operation', issuer: 'OEM', expiryDate: addDays(t, 15) });

  d.hseEvents = [
    { id: uid('hs'), type: 'Observation', date: addDays(t, -1), rigId: 'rig-1', description: 'Tong safety door not latched during make-up', action: 'Stopped job, briefed crew', status: 'Closed', reportedBy: 'Khalid Al-Qahtani' },
    { id: uid('hs'), type: 'Near Miss', date: addDays(t, -6), rigId: 'rig-2', description: 'Dropped object (pin) from monkey board area', action: 'Investigation in progress', status: 'Open', reportedBy: 'Omar Hassan' },
  ];
  d.preps = [
    { id: uid('wp'), jobNo: 'J-260904', jobId: 'job-l4', rigId: 'rig-4', sizes: [{ size: '13 3/8"', connection: 'BTC', weight: '68 ppf', qty: 95 }], equipmentIds: ['eq-1', 'eq-6'], assignedTo: ['emp-8', 'emp-9'], requiredDate: addDays(t, 1), status: 'In Preparation', checklist: [{ text: 'Tong function test', done: true }, { text: 'Jaws & dies for 13 3/8"', done: false }, { text: 'Torque-turn calibration cert', done: false }], createdAt: nowIso() },
    { id: uid('wp'), jobNo: 'J-260905', jobId: 'job-l5', rigId: 'rig-5', sizes: [{ size: '5 1/2"', connection: 'VAM TOP', qty: 120 }, { size: '4 1/2"', connection: 'VAM TOP', qty: 80 }], equipmentIds: [], assignedTo: ['emp-9'], requiredDate: addDays(t, 4), status: 'Requested', checklist: [{ text: 'Dual-size jaw kits', done: false }], createdAt: nowIso() },
  ];

  d.rigs = rigs;
  d.jobs = jobs;
  d.employees = employees;
  return d;
}
