import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PriorityCode,
  PRIORITY_CATALOG,
  comparePriority,
  validateTicketTransition,
  computeProjectSummaryMetrics,
  SemVerSchema,
  Ticket,
  TicketDecision,
} from './contracts';

test('Priority Precedence System matches specification order 1..6', () => {
  const ordered = [
    PriorityCode.P3_ENHANCEMENT,
    PriorityCode.P1_DEFECT,
    PriorityCode.P2_ENHANCEMENT,
    PriorityCode.P1_ENHANCEMENT,
    PriorityCode.P3_DEFECT,
    PriorityCode.P2_DEFECT,
  ].sort(comparePriority);

  assert.deepEqual(ordered, [
    PriorityCode.P1_DEFECT,
    PriorityCode.P1_ENHANCEMENT,
    PriorityCode.P2_DEFECT,
    PriorityCode.P2_ENHANCEMENT,
    PriorityCode.P3_DEFECT,
    PriorityCode.P3_ENHANCEMENT,
  ]);

  assert.equal(PRIORITY_CATALOG[PriorityCode.P1_DEFECT].display, 'Critical');
  assert.equal(PRIORITY_CATALOG[PriorityCode.P1_ENHANCEMENT].display, 'High');
  assert.equal(PRIORITY_CATALOG[PriorityCode.P2_DEFECT].display, 'High');
  assert.equal(PRIORITY_CATALOG[PriorityCode.P2_ENHANCEMENT].display, 'Normal');
  assert.equal(PRIORITY_CATALOG[PriorityCode.P3_DEFECT].display, 'Low');
  assert.equal(PRIORITY_CATALOG[PriorityCode.P3_ENHANCEMENT].display, 'Lowest');
});

test('Ticket transition blocks In Progress when required human decision is unanswered', () => {
  const baseTicket = {
    status: 'Backlog' as const,
    assigneeType: 'Agent' as const,
    acceptanceCriteria: [{ id: 'ac-1', text: 'AC 1', completed: true }],
    validationCriteria: [{ id: 'vc-1', text: 'VC 1', completed: false }],
  };

  const blockedCheck = validateTicketTransition(baseTicket, 'In Progress', [
    { required: true, status: 'Pending', answer: null },
  ]);
  assert.equal(blockedCheck.allowed, false);
  assert.ok(blockedCheck.reason?.includes('unanswered required human decision'));

  const allowedCheck = validateTicketTransition(baseTicket, 'In Progress', [
    { required: true, status: 'Resolved', answer: 'PostgreSQL 16 with Read Replicas' },
  ]);
  assert.equal(allowedCheck.allowed, true);
});

test('Ticket transition requires all validation criteria verified before Done', () => {
  const inReviewTicket = {
    status: 'In Review' as const,
    assigneeType: 'Agent' as const,
    acceptanceCriteria: [{ id: 'ac-1', text: 'AC 1', completed: true }],
    validationCriteria: [
      { id: 'vc-1', text: 'Integration test suite passes', completed: true },
      { id: 'vc-2', text: 'Zero P1 regressions', completed: false },
    ],
  };

  const failDone = validateTicketTransition(inReviewTicket, 'Done', []);
  assert.equal(failDone.allowed, false);
  assert.ok(failDone.reason?.includes('validation criterion'));

  inReviewTicket.validationCriteria[1].completed = true;
  const passDone = validateTicketTransition(inReviewTicket, 'Done', []);
  assert.equal(passDone.allowed, true);
});

test('Ticket transition records review rejection and reopen events accurately', () => {
  const rejectionCheck = validateTicketTransition(
    {
      status: 'In Review',
      assigneeType: 'Agent',
      acceptanceCriteria: [],
      validationCriteria: [],
    },
    'In Progress',
    []
  );
  assert.equal(rejectionCheck.allowed, true);
  assert.equal(rejectionCheck.isReviewRejection, true);

  const reopenCheck = validateTicketTransition(
    {
      status: 'Done',
      assigneeType: 'Human',
      acceptanceCriteria: [],
      validationCriteria: [],
    },
    'In Progress',
    []
  );
  assert.equal(reopenCheck.allowed, true);
  assert.equal(reopenCheck.isReopen, true);
});

test('SemVer validation strictly enforces MAJOR.MINOR.PATCH', () => {
  assert.equal(SemVerSchema.safeParse('2.4.0').success, true);
  assert.equal(SemVerSchema.safeParse('0.1.10').success, true);
  assert.equal(SemVerSchema.safeParse('v2.4.0').success, false);
  assert.equal(SemVerSchema.safeParse('2.4').success, false);
});

test('UTC Project Summary Metrics accurately aggregate 7d KPIs and 30d series without double-counting', () => {
  const nowUtc = '2026-11-07T12:00:00.000Z';
  const mockTickets: Ticket[] = [
    {
      id: 'PIN-1',
      projectId: 'p1',
      projectCode: 'PIN',
      sequenceNumber: 1,
      title: 'Recent Completed Ticket',
      assignmentType: 'Enhancement',
      priority: PriorityCode.P1_ENHANCEMENT,
      status: 'Done',
      description: 'Desc',
      acceptanceCriteria: [],
      validationCriteria: [],
      assigneeId: 'u1',
      assigneeName: 'Agent',
      assigneeType: 'Agent',
      creatorId: 'u1',
      creatorName: 'Lead',
      releaseId: null,
      releaseVersion: null,
      createdAt: '2026-11-03T10:00:00.000Z',
      updatedAt: '2026-11-05T15:00:00.000Z',
      completedAt: '2026-11-05T15:00:00.000Z',
      attachments: [],
      comments: [],
      agentSummary: null,
      version: 1,
    },
    {
      id: 'PIN-2',
      projectId: 'p1',
      projectCode: 'PIN',
      sequenceNumber: 2,
      title: 'Active Backlog Ticket',
      assignmentType: 'Defect',
      priority: PriorityCode.P1_DEFECT,
      status: 'Backlog',
      description: 'Desc',
      acceptanceCriteria: [],
      validationCriteria: [],
      assigneeId: 'u1',
      assigneeName: 'Agent',
      assigneeType: 'Agent',
      creatorId: 'u1',
      creatorName: 'Lead',
      releaseId: null,
      releaseVersion: null,
      createdAt: '2026-11-06T09:00:00.000Z',
      updatedAt: '2026-11-06T09:00:00.000Z',
      completedAt: null,
      attachments: [],
      comments: [],
      agentSummary: null,
      version: 1,
    },
  ];

  const mockDecisions: TicketDecision[] = [
    {
      id: 'd1',
      ticketId: 'PIN-2',
      projectCode: 'PIN',
      question: 'Rollback strategy?',
      context: 'Context',
      inputType: 'select',
      options: ['Snap', 'Full'],
      required: true,
      answer: null,
      status: 'Pending',
      assigneeId: 'u-elena',
      assigneeName: 'Elena Vance',
      priority: PriorityCode.P1_DEFECT,
      createdAt: '2026-11-06T09:05:00.000Z',
      version: 1,
    },
  ];

  const metrics = computeProjectSummaryMetrics(mockTickets, mockDecisions, nowUtc, false);
  assert.equal(metrics.completedLast7Days, 1);
  assert.equal(metrics.createdLast7Days, 2);
  assert.equal(metrics.completedAllTime, 1);
  assert.equal(metrics.outstandingTotal, 1);
  assert.equal(metrics.pendingDecisionsCount, 1);
  assert.equal(metrics.statusDistribution.Created, 0);
  assert.equal(metrics.statusDistribution.Backlog, 1);
  assert.equal(metrics.statusDistribution.Done, 1);
  assert.equal(metrics.dailyActivity30d.length, 30);
});
