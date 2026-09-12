export type DatabaseGuideDialect = "sql" | "mongodb";

export const DATABASE_GUIDE_MARKER = "[Guide]";

function has(source: string, pattern: RegExp): boolean {
  return pattern.test(source);
}

function unique(notes: string[]): string[] {
  return [...new Set(notes)];
}

function sqlNotes(source: string, description: string): string[] {
  const notes = [`Purpose: ${description}`];

  if (has(source, /\bWITH\s+RECURSIVE\b/i)) {
    notes.push("WITH RECURSIVE builds a temporary result iteratively: the non-recursive SELECT creates the seed rows, then the recursive SELECT keeps adding rows until its stop condition is false.");
  } else if (has(source, /\bWITH\b/i)) {
    notes.push("WITH defines a CTE: a named intermediate result that can be read by the main statement without creating a permanent table.");
  }
  if (has(source, /\bSET\s+@[A-Za-z_]/i)) {
    notes.push("SET stores a MySQL session variable. The later statement reads the same @variable, so one value can be reused without hard-coding it in several places.");
  }
  if (has(source, /\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\b/i)) {
    notes.push("CREATE VIEW saves the SELECT definition as a reusable virtual table; the view stores the query definition, not a separate copy of these result rows.");
  }
  if (has(source, /\bCREATE\s+TABLE\b/i)) {
    notes.push("CREATE TABLE defines the schema first: each column gets a data type and constraints describe what values are allowed and how rows are identified.");
  }
  if (has(source, /\bPRIMARY\s+KEY\b/i)) {
    notes.push("PRIMARY KEY makes the key unique and non-null, giving every row a stable identity that other tables can reference.");
  }
  if (has(source, /\bFOREIGN\s+KEY\b|\bREFERENCES\b/i)) {
    notes.push("FOREIGN KEY / REFERENCES enforces referential integrity: a child row can point only to a parent key that actually exists.");
  }
  if (has(source, /\bCREATE\s+UNIQUE\s+INDEX\b/i)) {
    notes.push("A UNIQUE INDEX is both an access path and a uniqueness rule: duplicate indexed values are rejected while lookups can use the index structure.");
  } else if (has(source, /\bCREATE\s+INDEX\b/i)) {
    notes.push("CREATE INDEX builds a secondary access path ordered by the indexed columns. It can avoid scanning every table row for matching lookups, at the cost of extra storage and write work.");
  }
  if (has(source, /\bEXPLAIN\b/i)) {
    notes.push("EXPLAIN asks the database for its execution plan so you can inspect scans, indexes, join order, and estimated work instead of judging performance only from the SQL text.");
  }
  if (has(source, /\bINSERT\s+INTO\b/i)) {
    notes.push("INSERT maps the listed values to the listed columns and creates a new row; omitted columns use their default value or NULL when the schema allows it.");
  }
  if (has(source, /\bUPDATE\b/i)) {
    notes.push("UPDATE first finds rows that satisfy WHERE, then SET changes only the named columns on those rows. The WHERE clause is therefore the safety boundary for the modification.");
  }
  if (has(source, /\bDELETE\s+FROM\b/i)) {
    notes.push("DELETE removes rows that satisfy WHERE. Without a WHERE clause, every row in the target table would be eligible for deletion.");
  }
  if (has(source, /\bDROP\s+TABLE\b/i)) {
    notes.push("DROP TABLE removes the table object itself, including its data and table-level indexes; IF EXISTS makes the cleanup safe when the table is already absent.");
  }
  if (has(source, /\bBEGIN\b|\bSTART\s+TRANSACTION\b/i)) {
    notes.push("BEGIN / START TRANSACTION groups the following changes into one transaction so they can be committed together or rolled back together.");
  }
  if (has(source, /\bROLLBACK\b/i)) {
    notes.push("ROLLBACK discards the uncommitted changes made in this transaction, which makes the example safe for experimenting with writes.");
  }
  if (has(source, /\bCOMMIT\b/i)) {
    notes.push("COMMIT makes all changes in the current transaction durable as one logical unit.");
  }
  if (has(source, /\bSELECT\b/i)) {
    notes.push("SELECT is the projection step: it controls which expressions or columns are returned to the result set; aliases rename calculated output columns only.");
  }
  if (has(source, /\bFROM\b/i)) {
    notes.push("FROM establishes the source rows. Any table aliases introduced here are short names used by the remaining clauses to disambiguate columns.");
  }
  if (has(source, /\b(?:INNER|LEFT|RIGHT|FULL)?\s*JOIN\b/i)) {
    notes.push("JOIN combines rows from two sources. The ON condition defines which rows match; with a LEFT JOIN, unmatched left-side rows still survive with NULL values from the right side.");
  }
  if (has(source, /\bWHERE\b/i) && !has(source, /\bUPDATE\b|\bDELETE\s+FROM\b/i)) {
    notes.push("WHERE filters individual source rows before grouping and final projection, so rows that fail the predicate do not participate in later aggregation.");
  }
  if (has(source, /\bGROUP\s+BY\b/i)) {
    notes.push("GROUP BY collapses rows with the same grouping key into one group; aggregate functions such as COUNT, SUM, AVG, MIN, or MAX then calculate one value per group.");
  }
  if (has(source, /\bHAVING\b/i)) {
    notes.push("HAVING filters groups after aggregation. Use it for conditions on aggregate results; WHERE cannot filter a value that has not been aggregated yet.");
  }
  if (has(source, /\bOVER\s*\(/i)) {
    notes.push("A window function uses OVER(...) to calculate across related rows without collapsing them. PARTITION BY creates independent windows while ORDER BY defines the row order inside each window.");
  }
  if (has(source, /\bROW_NUMBER\s*\(/i)) {
    notes.push("ROW_NUMBER assigns 1, 2, 3… inside each window partition, which is useful for ranking or selecting the first row per group while keeping row-level detail.");
  }
  if (has(source, /\bEXISTS\s*\(/i)) {
    notes.push("EXISTS is a boolean test: it becomes true as soon as the correlated subquery finds one matching row, so the subquery does not need to return or count all matches.");
  }
  if (has(source, /\bCASE\b/i)) {
    notes.push("CASE evaluates conditions in order and returns the value from the first matching WHEN branch, allowing conditional values inside a normal SELECT or aggregate.");
  }
  if (has(source, /JSON_|->>|->\s*'|::json/i)) {
    notes.push("The JSON expression reads a value stored inside a JSON document. The exact operator differs by engine, but the result can then be filtered, projected, or compared like another SQL expression.");
  }
  if (has(source, /CONCAT\s*\(|\|\|/i)) {
    notes.push("The concatenation expression combines text values into one result; MySQL commonly uses CONCAT(...) while PostgreSQL also supports the || operator.");
  }
  if (has(source, /\bORDER\s+BY\b/i)) {
    notes.push("ORDER BY sorts the final candidate rows by the listed expressions; DESC means largest/newest first and ASC means smallest/oldest first.");
  }
  if (has(source, /\bLIMIT\b/i)) {
    notes.push("LIMIT is applied at the end to cap how many rows are returned, which keeps an exploratory playground query small and readable.");
  }
  if (has(source, /\bSELECT\b/i) && has(source, /\bFROM\b/i)) {
    const logical: string[] = ["FROM/JOIN"];
    if (has(source, /\bWHERE\b/i)) logical.push("WHERE");
    if (has(source, /\bGROUP\s+BY\b/i)) logical.push("GROUP BY");
    if (has(source, /\bHAVING\b/i)) logical.push("HAVING");
    logical.push("SELECT/window expressions");
    if (has(source, /\bORDER\s+BY\b/i)) logical.push("ORDER BY");
    if (has(source, /\bLIMIT\b/i)) logical.push("LIMIT");
    notes.push(`Logical reading order is ${logical.join(" → ")}. That order explains where filtering, aggregation, calculation, sorting, and limiting actually happen.`);
  }

  return unique(notes);
}

function mongoNotes(source: string, description: string): string[] {
  const notes = [`Purpose: ${description}`];
  const invocation = source.match(/db\.([A-Za-z][A-Za-z0-9_]*)\.([A-Za-z][A-Za-z0-9_]*)\s*\(/);
  if (invocation) {
    notes.push(`db.${invocation[1]} selects the '${invocation[1]}' collection and ${invocation[2]}() is the operation executed against that collection.`);
  }
  if (has(source, /\.find\s*\(/)) {
    notes.push("find() uses its first object as the filter. Every returned document must satisfy that filter; an empty {} filter intentionally matches every document.");
    if (has(source, /\.find\s*\([\s\S]*?,[\s\S]*?\)/)) {
      notes.push("The second find() object is a projection: fields set to 1 are included and _id can be explicitly suppressed with 0.");
    }
  }
  if (has(source, /\.findOne\s*\(/)) {
    notes.push("findOne() applies the filter and stops after the first matching document, so the result is one document or no document rather than a cursor of many rows.");
  }
  if (has(source, /\.countDocuments\s*\(/)) {
    notes.push("countDocuments() applies the filter and returns a count instead of materializing the matching documents themselves.");
  }
  if (has(source, /\$elemMatch/)) {
    notes.push("$elemMatch requires one array element to satisfy all nested conditions together; different array elements cannot each satisfy only part of the condition.");
  }
  if (has(source, /"[A-Za-z0-9_]+\.[A-Za-z0-9_.]+"\s*:/)) {
    notes.push("Dot notation addresses a nested field directly, so MongoDB can filter embedded objects without first flattening them into separate tables.");
  }
  if (has(source, /\.aggregate\s*\(/)) {
    notes.push("aggregate() runs a pipeline. Stages execute from top to bottom, and each stage receives the documents produced by the previous stage.");
  }
  if (has(source, /"\$match"/)) {
    notes.push("$match filters pipeline documents. Putting a selective $match early usually reduces the amount of work later stages must perform.");
  }
  if (has(source, /"\$group"/)) {
    notes.push("$group creates one output document per _id grouping key. Accumulators such as $sum or $avg calculate values across all documents in each group.");
  }
  if (has(source, /"\$unwind"/)) {
    notes.push("$unwind expands an array so each array element becomes its own pipeline document, allowing later stages to group or filter individual elements.");
  }
  if (has(source, /"\$lookup"/)) {
    notes.push("$lookup reads matching documents from another collection and stores them in an array field. localField is read from the current document and matched against foreignField in the target collection.");
  }
  if (has(source, /"\$facet"/)) {
    notes.push("$facet sends the same incoming document set through several independent sub-pipelines, then returns all of their outputs together in one document.");
  }
  if (has(source, /"\$let"/)) {
    notes.push("$let creates expression-local variables under vars and uses them inside in. These variables exist only while that expression is evaluated; stored documents are not changed.");
  }
  if (has(source, /"\$project"/)) {
    notes.push("$project reshapes the output document: it can keep fields, remove fields such as _id, rename values, or calculate new expressions without modifying stored data.");
  }
  if (has(source, /"\$set"\s*:/) && has(source, /\.aggregate\s*\(/)) {
    notes.push("Pipeline $set adds or replaces computed fields on documents flowing through the pipeline; it changes the pipeline output, not the stored collection.");
  }
  if (has(source, /"\$cond"/)) {
    notes.push("$cond is MongoDB's conditional expression: evaluate a condition, return the second value when true, otherwise return the third value.");
  }
  if (has(source, /\.sort\s*\(/)) {
    notes.push("sort() orders the matching documents; 1 means ascending and -1 means descending for the specified field.");
  }
  if (has(source, /\.limit\s*\(/)) {
    notes.push("limit() caps the cursor after filtering/sorting so an exploratory query returns only a small, readable sample.");
  }
  if (has(source, /\.insertOne\s*\(/)) {
    notes.push("insertOne() stores exactly one new document. MongoDB creates the collection automatically when it does not already exist and generates _id when one is not supplied.");
  }
  if (has(source, /\.updateOne\s*\(/)) {
    notes.push("updateOne() first finds one document with the filter object, then applies the update operators from the second object instead of replacing the whole document.");
  }
  if (has(source, /"\$set"\s*:/) && has(source, /\.updateOne\s*\(/)) {
    notes.push("Update operator $set changes only the named fields, including nested fields addressed with dot notation; all other fields remain untouched.");
  }
  if (has(source, /"\$inc"\s*:/)) {
    notes.push("$inc performs an atomic numeric increment on the matched document, avoiding a read-modify-write sequence in client code.");
  }
  if (has(source, /\.deleteOne\s*\(/)) {
    notes.push("deleteOne() removes at most one document that matches the filter, so the filter is the safety boundary for the deletion.");
  }
  if (has(source, /\.createIndex\s*\(/)) {
    notes.push("createIndex() builds an ordered index using the listed key directions. Compound index field order matters because queries can efficiently use its leftmost prefix.");
  }
  if (has(source, /\.getIndexes\s*\(/)) {
    notes.push("getIndexes() returns index definitions for the collection so you can see which access paths and uniqueness rules currently exist.");
  }
  if (has(source, /\.explain\s*\(/)) {
    notes.push("explain('executionStats') returns the execution plan plus observed execution counters, which lets you see whether MongoDB used an index or scanned documents.");
  }

  return unique(notes);
}

export function stripDatabaseGuideComments(source: string): string {
  return source
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:--|\/\/)\s*\[Guide\]\s*/.test(line))
    .join("\n")
    .trim();
}

export function buildDatabaseGuide(source: string, title: string, description: string, dialect: DatabaseGuideDialect): string {
  const clean = stripDatabaseGuideComments(source).trim();
  if (!clean) return clean;
  const prefix = dialect === "mongodb" ? "//" : "--";
  const notes = dialect === "mongodb" ? mongoNotes(clean, description) : sqlNotes(clean, description);
  const header = [
    `${prefix} ${DATABASE_GUIDE_MARKER} ${title}`,
    ...notes.map((note, index) => `${prefix} ${DATABASE_GUIDE_MARKER} ${index + 1}. ${note}`),
    `${prefix} ${DATABASE_GUIDE_MARKER} The executable statement starts below; these guide comments are removed by the playground proxy before execution.`,
  ];
  return `${header.join("\n")}\n\n${clean}`;
}
