export type MysqlLearningExample = {
  category: "Tables & data" | "Joins";
  title: string;
  description: string;
  reasoning: string[];
  sql: string;
};

export const MYSQL_SELF_JOIN_LEARNING_EXAMPLES: MysqlLearningExample[] = [
  {
    category: "Tables & data",
    title: "Inspect · Weather comparison data",
    description: "Look at the seeded Weather rows before building the previous-day self-join.",
    reasoning: [
      "The answer will depend on two different Weather rows: one current day and one previous day.",
      "Before writing a JOIN, identify the columns that define the relationship: recordDate tells us which rows are consecutive, and temperature is the value we will compare.",
      "Expected result: 4 source rows. Keep those four dates in mind while you watch the JOIN reduce possible pairs in the next steps.",
    ],
    sql: `SELECT id, recordDate, temperature
FROM Weather
ORDER BY recordDate;`,
  },
  {
    category: "Tables & data",
    title: "Inspect · Activity process data",
    description: "Look at the seeded Activity rows before building the start/end self-join.",
    reasoning: [
      "Each process is represented by two rows: one start event and one end event.",
      "The columns machine_id + process_id identify the process; activity_type tells us which row is start or end; timestamp is the value we eventually subtract.",
      "Expected result: 12 source rows = 3 machines × 2 processes × 2 events. The target is eventually one duration per process, then one average per machine.",
    ],
    sql: `SELECT machine_id, process_id, activity_type, timestamp
FROM Activity
ORDER BY machine_id, process_id, timestamp;`,
  },
  {
    category: "Joins",
    title: "Weather self-join · 1 · all pairs",
    description: "Start by giving the same Weather table two roles and inspect the candidate row pairs before deciding which pair is meaningful.",
    reasoning: [
      "The answer depends on two different rows: a current day and a previous day. Because both rows live in Weather, read Weather twice with two aliases.",
      "CROSS JOIN intentionally shows every possible pair. Most pairs are wrong; seeing them makes the purpose of the next ON condition obvious.",
      "Expected result: 16 rows because 4 possible today rows × 4 possible previous rows = 16 candidate pairs.",
    ],
    sql: `SELECT today.id AS today_id,
       today.recordDate AS today_date,
       today.temperature AS today_temp,
       previous.id AS previous_id,
       previous.recordDate AS previous_date,
       previous.temperature AS previous_temp
FROM Weather AS today
CROSS JOIN Weather AS previous
ORDER BY today.recordDate, previous.recordDate;`,
  },
  {
    category: "Joins",
    title: "Weather self-join · 2 · consecutive days",
    description: "Now define the relationship between the aliases: the previous row must be exactly one calendar day before the current row.",
    reasoning: [
      "The task says the previous day, not any earlier date. DATEDIFF = 1 deliberately keeps only yesterday for each current day.",
      "If the requirement were 'compare with every earlier day', the relationship would instead be previous.recordDate < today.recordDate.",
      "Expected result: 3 rows: Jan 2 ↔ Jan 1, Jan 3 ↔ Jan 2, and Jan 4 ↔ Jan 3. Jan 1 has no previous day in the table.",
    ],
    sql: `SELECT today.id AS today_id,
       today.recordDate AS today_date,
       today.temperature AS today_temp,
       previous.recordDate AS previous_date,
       previous.temperature AS previous_temp
FROM Weather AS today
JOIN Weather AS previous
  ON DATEDIFF(today.recordDate, previous.recordDate) = 1
ORDER BY today.recordDate;`,
  },
  {
    category: "Joins",
    title: "Weather self-join · 3 · warmer than yesterday",
    description: "Only after the correct day pairs exist, add the actual business condition: today's temperature must be higher than yesterday's.",
    reasoning: [
      "ON answers 'which two rows belong together?'. WHERE answers 'which of those valid pairs satisfy the requirement?'.",
      "Keeping the pairing rule and the temperature rule separate makes the query much easier to reason about and debug.",
      "Expected result: 2 rows. Jan 2 is warmer than Jan 1, Jan 3 is not warmer than Jan 2, and Jan 4 is warmer than Jan 3.",
    ],
    sql: `SELECT today.id AS today_id,
       today.recordDate AS today_date,
       today.temperature AS today_temp,
       previous.temperature AS previous_temp
FROM Weather AS today
JOIN Weather AS previous
  ON DATEDIFF(today.recordDate, previous.recordDate) = 1
WHERE today.temperature > previous.temperature
ORDER BY today.recordDate;`,
  },
  {
    category: "Joins",
    title: "Weather self-join · 4 · final answer",
    description: "The logic is already complete; now return only the column requested by the task.",
    reasoning: [
      "Do not start by trying to SELECT only id. During construction, keep the diagnostic columns visible so you can verify the pairs and comparison.",
      "Once the result rows are correct, reducing SELECT to today.id is just output formatting, not new logic.",
      "Expected final result: ids 2 and 4. The row count does not change from step 3; only the displayed columns change.",
    ],
    sql: `SELECT today.id
FROM Weather AS today
JOIN Weather AS previous
  ON DATEDIFF(today.recordDate, previous.recordDate) = 1
WHERE today.temperature > previous.temperature
ORDER BY today.id;`,
  },
  {
    category: "Joins",
    title: "Process duration · 1 · all pairs",
    description: "Read Activity twice so one alias can eventually represent start and the other end; first inspect the unfiltered combinations.",
    reasoning: [
      "A duration needs two different rows at the same time: one start timestamp and one end timestamp.",
      "Both rows are in Activity, so use a self-join. CROSS JOIN exposes the raw combinations before we teach SQL which rows belong together.",
      "Expected result: 144 rows because the 12 Activity rows can pair with all 12 Activity rows: 12 × 12.",
    ],
    sql: `SELECT s.machine_id AS s_machine,
       s.process_id AS s_process,
       s.activity_type AS s_type,
       s.timestamp AS s_time,
       e.machine_id AS e_machine,
       e.process_id AS e_process,
       e.activity_type AS e_type,
       e.timestamp AS e_time
FROM Activity AS s
CROSS JOIN Activity AS e
ORDER BY s.machine_id, s.process_id, s.timestamp,
         e.machine_id, e.process_id, e.timestamp;`,
  },
  {
    category: "Joins",
    title: "Process duration · 2 · same machine",
    description: "Add the first relationship: the two candidate rows may pair only when they belong to the same machine.",
    reasoning: [
      "This condition removes combinations across different machines, but it is intentionally not enough yet.",
      "You should still see process 0 mixed with process 1 inside one machine; that visible mistake tells us the next condition we need.",
      "Expected result: 48 rows. Each machine has 4 Activity rows, so it contributes 4 × 4 = 16 pairs; 3 machines produce 48.",
    ],
    sql: `SELECT s.machine_id,
       s.process_id AS s_process,
       s.activity_type AS s_type,
       e.process_id AS e_process,
       e.activity_type AS e_type
FROM Activity AS s
JOIN Activity AS e
  ON s.machine_id = e.machine_id
ORDER BY s.machine_id, s.process_id, e.process_id;`,
  },
  {
    category: "Joins",
    title: "Process duration · 3 · same process",
    description: "Add process_id so the two aliases now refer to rows from the same machine and the same process.",
    reasoning: [
      "machine_id + process_id identifies the process whose two event rows we want to combine.",
      "The result still contains start/start, start/end, end/start and end/end. That is expected: row identity is fixed, but alias roles are not fixed yet.",
      "Expected result: 24 rows. There are 6 processes, and each process still produces 2 × 2 = 4 event-role combinations.",
    ],
    sql: `SELECT s.machine_id,
       s.process_id,
       s.activity_type AS s_type,
       s.timestamp AS s_time,
       e.activity_type AS e_type,
       e.timestamp AS e_time
FROM Activity AS s
JOIN Activity AS e
  ON s.machine_id = e.machine_id
 AND s.process_id = e.process_id
ORDER BY s.machine_id, s.process_id, s.timestamp, e.timestamp;`,
  },
  {
    category: "Joins",
    title: "Process duration · 4 · start to end",
    description: "Now assign the aliases their intended roles: s is the start row and e is the end row.",
    reasoning: [
      "The join keys answer which process the rows belong to; these filters answer which event each alias represents.",
      "After this step, every result row should contain exactly one process with its correct start and end timestamps side by side.",
      "Expected result: 6 rows = one start/end pair for each of the 6 processes. The unwanted start/start, end/start and end/end combinations disappear.",
    ],
    sql: `SELECT s.machine_id,
       s.process_id,
       s.timestamp AS start_time,
       e.timestamp AS end_time
FROM Activity AS s
JOIN Activity AS e
  ON s.machine_id = e.machine_id
 AND s.process_id = e.process_id
WHERE s.activity_type = 'start'
  AND e.activity_type = 'end'
ORDER BY s.machine_id, s.process_id;`,
  },
  {
    category: "Joins",
    title: "Process duration · 5 · calculate duration",
    description: "With the correct start and end already on one row, calculate each process duration with a simple subtraction.",
    reasoning: [
      "Do the arithmetic only after the row pairing is correct. Otherwise SQL can calculate a perfectly valid number from the wrong two events.",
      "Keeping start_time and end_time in SELECT while learning lets you verify that duration = end - start for every row.",
      "Expected result: still 6 rows. We are adding a calculated column, not filtering or grouping rows.",
    ],
    sql: `SELECT s.machine_id,
       s.process_id,
       s.timestamp AS start_time,
       e.timestamp AS end_time,
       e.timestamp - s.timestamp AS duration
FROM Activity AS s
JOIN Activity AS e
  ON s.machine_id = e.machine_id
 AND s.process_id = e.process_id
WHERE s.activity_type = 'start'
  AND e.activity_type = 'end'
ORDER BY s.machine_id, s.process_id;`,
  },
  {
    category: "Joins",
    title: "Process duration · 6 · average per machine",
    description: "Only after each process has a correct duration, group those process rows by machine and average them.",
    reasoning: [
      "GROUP BY is the last step because AVG should receive one correct duration per process, not the raw Activity event rows.",
      "ROUND(..., 3) changes display precision only; AVG(e.timestamp - s.timestamp) is the actual calculation.",
      "Expected final result: 3 rows — machine 0 = 0.894, machine 1 = 0.995, machine 2 = 1.456.",
    ],
    sql: `SELECT s.machine_id,
       ROUND(AVG(e.timestamp - s.timestamp), 3) AS processing_time
FROM Activity AS s
JOIN Activity AS e
  ON s.machine_id = e.machine_id
 AND s.process_id = e.process_id
WHERE s.activity_type = 'start'
  AND e.activity_type = 'end'
GROUP BY s.machine_id
ORDER BY s.machine_id;`,
  },
];
