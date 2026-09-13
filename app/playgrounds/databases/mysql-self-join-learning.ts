export type MysqlLearningExample = {
  category: "Tables & data" | "Joins";
  title: string;
  description: string;
  reasoning: string[];
  sql: string;
  injected?: boolean;
};

export const MYSQL_SELF_JOIN_LEARNING_EXAMPLES: MysqlLearningExample[] = [
  {
    category: "Tables & data",
    title: "Setup · Weather comparison data",
    description: "Create the real Weather table used by the step-by-step previous-day comparison examples.",
    reasoning: [
      "Run this once before the Weather join steps. It creates normal sandbox data, not a CTE hidden inside the solution.",
      "Each date has one temperature. The later query must place two different Weather rows side by side before it can compare their temperatures.",
    ],
    injected: true,
    sql: `DROP TABLE IF EXISTS Weather;

CREATE TABLE Weather (
  id INT NOT NULL PRIMARY KEY,
  recordDate DATE NOT NULL,
  temperature INT NOT NULL
);

INSERT INTO Weather (id, recordDate, temperature) VALUES
  (1, '2015-01-01', 10),
  (2, '2015-01-02', 25),
  (3, '2015-01-03', 20),
  (4, '2015-01-04', 30);

SELECT *
FROM Weather
ORDER BY recordDate;`,
  },
  {
    category: "Tables & data",
    title: "Setup · Activity process data",
    description: "Create the real Activity table used by the step-by-step process-duration examples.",
    reasoning: [
      "Run this once before the Activity join steps. Every process is stored as two rows: one start row and one end row.",
      "The later query must first pair those two rows for the same machine and process; only then does end minus start make sense.",
    ],
    injected: true,
    sql: `DROP TABLE IF EXISTS Activity;

CREATE TABLE Activity (
  machine_id INT NOT NULL,
  process_id INT NOT NULL,
  activity_type ENUM('start', 'end') NOT NULL,
  timestamp DECIMAL(10,3) NOT NULL,
  PRIMARY KEY (machine_id, process_id, activity_type)
);

INSERT INTO Activity (machine_id, process_id, activity_type, timestamp) VALUES
  (0, 0, 'start', 0.712),
  (0, 0, 'end',   1.520),
  (0, 1, 'start', 3.140),
  (0, 1, 'end',   4.120),
  (1, 0, 'start', 0.550),
  (1, 0, 'end',   1.550),
  (1, 1, 'start', 0.430),
  (1, 1, 'end',   1.420),
  (2, 0, 'start', 4.100),
  (2, 0, 'end',   4.512),
  (2, 1, 'start', 2.500),
  (2, 1, 'end',   5.000);

SELECT *
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
    description: "Add the first relationship: a start-side row may pair only with an end-side row from the same machine.",
    reasoning: [
      "This condition removes combinations across different machines, but it is intentionally not enough yet.",
      "You should still see process 0 mixed with process 1 inside one machine; that visible mistake tells us the next condition we need.",
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
