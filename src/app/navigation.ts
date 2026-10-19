import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  House,
  MessageSquareText,
  Settings,
  UsersRound,
  ChartNoAxesCombined,
} from 'lucide-react';

export const navigation = [
  {
    id: 'home',
    label: 'Inicio',
    href: '#/inicio',
    icon: House,
    description: 'Tu día escolar, de un vistazo.',
  },
  {
    id: 'students',
    label: 'Alumnos',
    href: '#/alumnos',
    icon: UsersRound,
    description: 'Un espacio para conocer y acompañar a cada alumno.',
    preview: 'Aquí podrás consultar la lista de tu grupo y la ficha de cada alumno.',
  },
  {
    id: 'attendance',
    label: 'Asistencia',
    href: '#/asistencia',
    icon: CalendarCheck,
    description: 'Cada día cuenta.',
    preview: 'Aquí podrás registrar la asistencia diaria y consultar el historial de tu grupo.',
  },
  {
    id: 'assignments',
    label: 'Tareas',
    href: '#/tareas',
    icon: ClipboardList,
    description: 'Organiza las actividades de tu grupo.',
    preview: 'Aquí podrás organizar las tareas y dar seguimiento a las entregas.',
  },
  {
    id: 'reading',
    label: 'Lectura en casa',
    href: '#/lectura',
    icon: BookOpen,
    description: 'Pequeñas lecturas, grandes descubrimientos.',
    preview: 'Aquí podrás consultar las lecturas de cada alumno y sus minutos de lectura.',
  },
  {
    id: 'notes',
    label: 'Observaciones',
    href: '#/observaciones',
    icon: MessageSquareText,
    description: 'Los detalles también cuentan una historia.',
    preview: 'Aquí podrás llevar notas sobre el aprendizaje y la participación de tus alumnos.',
  },
  {
    id: 'reports',
    label: 'Reportes',
    href: '#/reportes',
    icon: ChartNoAxesCombined,
    description: 'Una mirada al recorrido de tu grupo.',
    preview: 'Aquí podrás consultar resúmenes y preparar reportes de la actividad escolar.',
  },
  {
    id: 'settings',
    label: 'Configuración',
    href: '#/configuracion',
    icon: Settings,
    description: 'Tu espacio, a tu manera.',
    preview: 'Aquí podrás administrar tus ciclos escolares, grupos y preferencias de ClassNote.',
  },
] as const;

export type NavigationItem = (typeof navigation)[number];

export function resolveSection(hash: string): NavigationItem | undefined {
  return navigation.find((item) => item.href === hash);
}
