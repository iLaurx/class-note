import ExcelJS from 'exceljs';
import type { Repositories } from '../../db/repositories.ts';
import { includesDate } from '../../features/attendance/attendanceDomain.ts';
import { attendanceLabels } from '../../features/attendance/attendanceDomain.ts';
import { submissionLabels } from '../../features/assignments/assignmentDomain.ts';

export type GroupReport = Awaited<ReturnType<Repositories['loadGroupReport']>>;

// Keep user content as a string, including whitespace; never create formula objects.
export function safeCell(value: string): string {
  return /^[\s]*[=+\-@\t\r\n]|^[\t\r\n]/u.test(value) ? `'${value}` : value;
}

function day(value: string | undefined) {
  return value ? value.split('-').reverse().join('/') : '';
}

export async function groupWorkbook(data: GroupReport): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const students = new Map(data.students.map((row) => [row.id, row]));
  const names = new Map(
    data.enrollments.map((row) => {
      const student = students.get(row.studentId)!;
      return [row.id, `${student.lastName}, ${student.firstName}`];
    }),
  );
  const compareMembers = (a: string, b: string) =>
    names.get(a)!.localeCompare(names.get(b)!, 'es') || a.localeCompare(b);
  const members = [...data.enrollments].sort((a, b) => compareMembers(a.id, b.id));
  const submissions = new Map(
    data.submissions.map((row) => [`${row.assignmentId}:${row.enrollmentId}`, row]),
  );
  const addSheet = (name: string, headers: string[], rows: (string | number)[][]) => {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF365B42' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    for (const row of rows.length ? rows : [['Sin registros para este reporte.']]) {
      sheet.addRow(row.map((value) => (typeof value === 'string' ? safeCell(value) : value)));
    }
    sheet.columns.forEach((column, index) => {
      column.width = Math.min(48, Math.max(18, headers[index]!.length + 4));
      column.alignment = { vertical: 'top', wrapText: true };
    });
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, rows.length + 1), column: headers.length },
    };
    sheet.headerFooter.oddHeader = 'ClassNote · Reporte del grupo';
    sheet.headerFooter.oddFooter = `${day(data.range.from)} a ${day(data.range.to)} · Reporte no restaurable`;
  };
  addSheet(
    'Alumnos',
    [
      'Matrícula',
      'Alumno',
      'Grado',
      'Grupo',
      'Turno',
      'Estado',
      'Fecha de matrícula',
      'Fecha de salida',
    ],
    members.map((row) => [
      row.id,
      names.get(row.id)!,
      data.group.grade,
      data.group.name,
      data.group.shift ?? '',
      row.status === 'active' ? 'Activa' : 'Inactiva',
      day(row.joinedAt),
      day(row.leftAt),
    ]),
  );
  addSheet(
    'Asistencia',
    ['Fecha', 'Alumno', 'Estado', 'Nota'],
    [...data.attendance]
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          compareMembers(a.enrollmentId, b.enrollmentId) ||
          a.id.localeCompare(b.id),
      )
      .map((row) => [
        day(row.date),
        names.get(row.enrollmentId)!,
        attendanceLabels[row.status],
        row.note ?? '',
      ]),
  );
  const taskRows: (string | number)[][] = [];
  for (const task of [...data.assignments].sort(
    (a, b) =>
      a.assignedDate.localeCompare(b.assignedDate) ||
      a.title.localeCompare(b.title, 'es') ||
      a.id.localeCompare(b.id),
  )) {
    // Preserve existing historical incidents as well as applicable members without a capture.
    const recipients = members.filter(
      (row) => includesDate(row, task.assignedDate) || submissions.has(`${task.id}:${row.id}`),
    );
    for (const member of recipients.length ? recipients : [null]) {
      const submission = member ? submissions.get(`${task.id}:${member.id}`) : undefined;
      taskRows.push([
        task.title,
        task.description ?? '',
        day(task.assignedDate),
        day(task.dueDate),
        member ? names.get(member.id)! : 'Sin matrículas aplicables',
        member ? submissionLabels[submission?.status ?? 'pending'] : '',
        submission?.comment ?? '',
      ]);
    }
  }
  addSheet(
    'Tareas',
    [
      'Tarea',
      'Descripción',
      'Fecha de asignación',
      'Fecha de entrega',
      'Alumno',
      'Estado de entrega',
      'Comentario',
    ],
    taskRows,
  );
  addSheet(
    'Lecturas',
    ['Fecha', 'Alumno', 'Título', 'Minutos', 'Comentario'],
    [...data.readings]
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          compareMembers(a.enrollmentId, b.enrollmentId) ||
          a.id.localeCompare(b.id),
      )
      .map((row) => [
        day(row.date),
        names.get(row.enrollmentId)!,
        row.title,
        row.minutes,
        row.comment ?? '',
      ]),
  );
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
