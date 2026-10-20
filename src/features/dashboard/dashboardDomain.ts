import type {
  Assignment,
  Attendance,
  Enrollment,
  ReadingLog,
  SchoolYear,
  Submission,
} from '../../domain/models.ts';
import { schoolDate } from '../../domain/validation.ts';
import { attendanceCounts, includesDate } from '../attendance/attendanceDomain.ts';
import { readingWeek } from '../reading/readingDomain.ts';

export function localDay(now = new Date()) {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function dashboardPeriod(today: string) {
  schoolDate(today);
  const [year, month, day] = today.split('-').map(Number) as [number, number, number];
  // Local noon and civil components: never parse an ISO day as a UTC instant.
  return {
    recentFrom: localDay(new Date(year, month - 1, day - 6, 12)),
    upcomingTo: localDay(new Date(year, month - 1, day + 6, 12)),
  };
}
export function dashboardSummary(
  year: SchoolYear,
  today: string,
  enrollments: readonly Enrollment[],
  attendance: readonly Attendance[],
  assignments: readonly Assignment[],
  submissions: readonly Submission[],
  logs: readonly ReadingLog[],
) {
  const period = dashboardPeriod(today);
  const inYear = today >= year.startDate && today <= year.endDate;
  const population = inYear ? enrollments.filter((row) => includesDate(row, today)) : [];
  const attendanceByMember = new Map(
    attendance.filter((row) => row.date === today).map((row) => [row.enrollmentId, row]),
  );
  const states = new Map(
    submissions.map((row) => [`${row.assignmentId}:${row.enrollmentId}`, row.status]),
  );
  const agenda = assignments
    .filter(
      (row) =>
        (row.assignedDate >= period.recentFrom && row.assignedDate <= today) ||
        (row.dueDate !== undefined && row.dueDate >= today && row.dueDate <= period.upcomingTo),
    )
    .sort(
      (a, b) =>
        (a.dueDate ?? a.assignedDate).localeCompare(b.dueDate ?? b.assignedDate) ||
        a.id.localeCompare(b.id),
    )
    .map((assignment) => {
      const members = enrollments.filter((row) => includesDate(row, assignment.assignedDate));
      const ids = new Set(members.map((row) => row.id));
      return {
        ...assignment,
        population: members.length,
        pending: members.filter(
          (row) => (states.get(`${assignment.id}:${row.id}`) ?? 'pending') === 'pending',
        ).length,
        incidents: submissions.filter(
          (row) => row.assignmentId === assignment.id && !ids.has(row.enrollmentId),
        ).length,
      };
    });
  const week = readingWeek(today);
  const ids = new Set(enrollments.map((row) => row.id));
  const readings = logs.filter(
    (row) => ids.has(row.enrollmentId) && row.date >= week.from && row.date <= week.to,
  );
  return {
    today,
    inYear,
    ...period,
    students: population.length,
    attendance: inYear
      ? attendanceCounts(
          population.map((row) => ({ status: attendanceByMember.get(row.id)?.status ?? '' })),
        )
      : null,
    assignments: agenda,
    reading: {
      ...week,
      count: readings.length,
      minutes: readings.reduce((sum, row) => sum + row.minutes, 0),
    },
  };
}
