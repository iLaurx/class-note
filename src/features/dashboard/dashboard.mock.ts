// Datos visuales sintéticos. No son entidades de dominio ni se guardan.
export const dashboardMock = {
  schoolYear: '2026–2027',
  group: '3.º A',
  shift: 'Turno matutino',
  dateLabel: 'Lunes, 19 de octubre de 2026',
  date: '2026-10-19',
  students: 28,
  present: 26,
  absent: 2,
  pendingAssignments: 3,
  assignments: [
    {
      title: 'Exploramos las multiplicaciones',
      subject: 'Matemáticas',
      due: 'Para hoy',
      tone: 'amber',
    },
    { title: 'Mi cuento favorito', subject: 'Lenguajes', due: 'Para mañana', tone: 'green' },
    {
      title: 'Las plantas de mi comunidad',
      subject: 'Ciencias',
      due: 'Para el miércoles',
      tone: 'blue',
    },
  ],
} as const;
