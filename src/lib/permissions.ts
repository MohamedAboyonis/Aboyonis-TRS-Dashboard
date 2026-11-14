import type { AppData, Employee, Permission, Role } from './types';

export const PERMISSION_GROUPS: { group: string; items: { key: Permission; label: string }[] }[] = [
  { group: 'General', items: [{ key: 'dashboard.view', label: 'View dashboard & KPIs' }] },
  {
    group: 'Operations',
    items: [
      { key: 'ops.view', label: 'View rigs & jobs' },
      { key: 'ops.manage', label: 'Add / edit rigs, current & next operations, jobs' },
    ],
  },
  {
    group: 'Field & Timesheets',
    items: [
      { key: 'field.register', label: 'Register on jobs & request leave (self-service)' },
      { key: 'timesheet.viewAll', label: 'View everyone\'s timesheets' },
      { key: 'timesheet.manage', label: 'Edit timesheets (safety day, absent, workshop day…) & register others' },
      { key: 'leave.approve', label: 'Approve / reject vacation & sick leave' },
    ],
  },
  {
    group: 'Workshop',
    items: [
      { key: 'workshop.view', label: 'View job preparations' },
      { key: 'workshop.manage', label: 'Create / update job preparations' },
    ],
  },
  {
    group: 'Training & HSE',
    items: [
      { key: 'hse.view', label: 'View certificates, training matrix & HSE log' },
      { key: 'hse.manage', label: 'Manage certificates, training requirements & HSE log' },
    ],
  },
  {
    group: 'Equipment & Maintenance',
    items: [
      { key: 'equipment.view', label: 'View equipment, maintenance, certificates & COC' },
      { key: 'equipment.manage', label: 'Manage equipment & maintenance records' },
    ],
  },
  {
    group: 'People',
    items: [
      { key: 'employees.view', label: 'View employee directory' },
      { key: 'employees.manage', label: 'Add / edit employees' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { key: 'admin.company', label: 'Company profile, logo & lists' },
      { key: 'admin.access', label: 'Roles, users & permissions' },
      { key: 'admin.license', label: 'License' },
      { key: 'admin.data', label: 'Backup / restore / reset data' },
    ],
  },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export function defaultRoles(): Role[] {
  return [
    { id: 'role-admin', name: 'Administrator', system: true, description: 'Full access', permissions: [...ALL_PERMISSIONS] },
    {
      id: 'role-ops',
      name: 'Operations',
      description: 'Operations team: rigs, jobs, timesheet control, leave approval',
      permissions: [
        'dashboard.view', 'ops.view', 'ops.manage', 'field.register', 'timesheet.viewAll', 'timesheet.manage',
        'leave.approve', 'workshop.view', 'hse.view', 'equipment.view', 'employees.view',
      ],
    },
    {
      id: 'role-field',
      name: 'Field Technician',
      description: 'Register on jobs, own timesheet, vacation & sick leave',
      permissions: ['ops.view', 'field.register', 'hse.view'],
    },
    {
      id: 'role-workshop',
      name: 'Workshop',
      description: 'Job preparations, equipment & maintenance',
      permissions: ['ops.view', 'field.register', 'workshop.view', 'workshop.manage', 'equipment.view', 'equipment.manage'],
    },
    {
      id: 'role-hse',
      name: 'Training & HSE',
      description: 'Certificates, training matrix, HSE events',
      permissions: ['dashboard.view', 'ops.view', 'field.register', 'hse.view', 'hse.manage', 'employees.view', 'equipment.view'],
    },
  ];
}

export function permissionsOf(data: AppData, user: Employee | null | undefined): Set<Permission> {
  if (!user) return new Set();
  const role = data.roles.find((r) => r.id === user.roleId);
  if (role?.id === 'role-admin') return new Set(ALL_PERMISSIONS);
  return new Set([...(role?.permissions ?? []), ...(user.extraPermissions ?? [])]);
}
