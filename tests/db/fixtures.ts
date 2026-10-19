import { Repositories } from '../../src/db/repositories.ts';

export async function createFixture(repositories: Repositories, label = 'Ciclo sintético 2026') {
  const year = await repositories.createSchoolYear({
    label,
    startDate: '2026-08-01',
    endDate: '2027-07-31',
  });
  const group = await repositories.createGroup({
    schoolYearId: year.id,
    grade: 1,
    name: 'Grupo sintético',
  });
  const student = await repositories.createStudent({
    firstName: 'Alumno ficticio',
    lastName: 'Prueba',
  });
  const context = { schoolYearId: year.id, groupId: group.id };
  const enrollment = await repositories.createEnrollment(context, {
    studentId: student.id,
    joinedAt: '2026-08-01',
    status: 'active',
  });
  const enrollmentContext = { ...context, enrollmentId: enrollment.id };
  const assignment = await repositories.createAssignment(context, {
    title: 'Tarea sintética',
    assignedDate: '2026-10-19',
  });
  return { year, group, student, enrollment, assignment, context, enrollmentContext };
}

export async function fillRelated(repositories: Repositories) {
  const fixture = await createFixture(repositories);
  await repositories.createAttendance(fixture.enrollmentContext, {
    date: '2026-10-19',
    status: 'present',
  });
  await repositories.createSubmission(fixture.enrollmentContext, {
    assignmentId: fixture.assignment.id,
    status: 'submitted',
  });
  await repositories.createReadingLog(fixture.enrollmentContext, {
    date: '2026-10-19',
    title: 'Libro sintético',
    minutes: 12,
  });
  await repositories.createStudentNote(fixture.enrollmentContext, {
    date: '2026-10-19',
    category: 'academic',
    body: 'Observación sintética',
  });
  await repositories.createSetting({ key: 'synthetic-test', value: true });
  return fixture;
}
