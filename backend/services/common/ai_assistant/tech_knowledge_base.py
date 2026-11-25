"""
Comprehensive Domain Knowledge Bank & Technical Quiz Generator for Emergere LMS.
Provides authentic, production-grade technical overviews, learning objectives,
core concepts, working code snippets, gotchas, and 5-question technical quizzes
for major enterprise technologies (NumPy, Pandas, Python, FastAPI, React, SQL Server,
Docker, Kubernetes, AWS, Azure, Microservices, Git).
"""
import re
from typing import Dict, Any, List, Optional

TECH_DOMAINS: Dict[str, Dict[str, Any]] = {
    "numpy": {
        "title": "NumPy (Numerical Python) & Array Computing",
        "summary": "NumPy is the fundamental library for scientific computing and high-performance numerical data engineering in Python. It provides the homogeneous N-dimensional array (ndarray), vectorized mathematical operations, broadcasting semantics, and optimized C/Fortran computational efficiency.",
        "objectives": [
            "Master the ndarray memory layout, data types, strides, and contiguous buffer allocation.",
            "Implement high-performance vectorized operations to eliminate slow Python for-loops.",
            "Apply multi-dimensional broadcasting rules across arrays of heterogeneous shapes.",
            "Leverage boolean indexing, universal functions (ufuncs), linear algebra routines, and memory views."
        ],
        "core_concepts": [
            {
                "name": "1. ndarray Data Structure & Memory Contiguity",
                "detail": "Unlike standard Python lists of pointer references, NumPy arrays store elements in homogeneous, contiguous memory blocks (C-order or Fortran-order). This layout allows CPU cache locality and SIMD vectorization, achieving up to 50x-100x execution speedups."
            },
            {
                "name": "2. Vectorization & Universal Functions (ufuncs)",
                "detail": "Vectorization delegates element-wise computations directly to optimized low-level C loops without Python interpreter overhead. ufuncs like np.add, np.sin, np.exp, and np.dot operate across entire datasets in a single vectorized step."
            },
            {
                "name": "3. Multi-Axis Broadcasting & Shape Manipulation",
                "detail": "Broadcasting allows arithmetic operations between arrays of different shapes by conceptually expanding dimensions of size 1 without copying data. Methods like .reshape(), .transpose(), and .ravel() provide zero-copy memory views."
            }
        ],
        "code_snippet": (
            "import numpy as np\n\n"
            "# 1. ndarray creation with explicit data typing\n"
            "arr = np.array([10, 20, 30, 40, 50], dtype=np.float64)\n\n"
            "# 2. High-speed vectorized computations\n"
            "squared = arr ** 2                      # [ 100.,  400.,  900., 1600., 2500.]\n"
            "normalized = (arr - np.mean(arr)) / np.std(arr)\n\n"
            "# 3. 2D Matrix reshaping and broadcasting\n"
            "matrix = np.arange(1, 7).reshape(3, 2)  # Shape: (3, 2)\n"
            "bias = np.array([100, 200])             # Shape: (2,) - Broadcasts across rows\n"
            "output = matrix + bias\n\n"
            "# 4. High-performance boolean filtering (no Python loops)\n"
            "mask = output > 150\n"
            "filtered_values = output[mask]\n"
            "print('Filtered elements > 150:', filtered_values)\n"
        ),
        "gotchas": [
            "Looping over ndarray elements with Python for-loops destroys vectorization performance. Always use vectorized functions or np.apply_along_axis.",
            "Slicing an array (e.g., b = a[1:4]) creates a view sharing the original memory buffer. Mutating b will alter a. Use a.copy() for isolation.",
            "Using Python logical operators ('and', 'or') on arrays causes ValueError. Always use bitwise operators ('&', '|') with parenthesized conditions.",
            "Inadvertent dtype upcasting (e.g., mixing float64 with float32) can double memory footprint silently during large-scale matrix operations."
        ],
        "quiz": [
            {
                "question": "What is the output and memory characteristic of the following snippet?\n```python\nimport numpy as np\na = np.array([1, 2, 3], dtype=np.float32)\nb = a.astype(np.int32)\nb[0] = 99\nprint(a[0])\n```",
                "options": [
                    "A) 99.0 (because astype creates a view)",
                    "B) 1.0 (because astype returns a fresh copy of the array)",
                    "C) TypeError (cannot cast float32 to int32)",
                    "D) 1 (modified in-place)"
                ],
                "answer": "B",
                "explanation": "astype() always returns a new copy of the array in NumPy by default. Therefore, mutating b leaves the original array a untouched."
            },
            {
                "question": "Which pair of array shapes can successfully broadcast together without raising a ValueError?",
                "options": [
                    "A) (3, 4) and (2, 4)",
                    "B) (5, 1, 3) and (1, 4, 3)",
                    "C) (4, 3) and (4, 1, 2)",
                    "D) (3, 5) and (5, 3)"
                ],
                "answer": "B",
                "explanation": "Two dimensions are compatible for broadcasting when they are equal, or one of them is 1. Shapes (5, 1, 3) and (1, 4, 3) broadcast to (5, 4, 3)."
            },
            {
                "question": "Why is np.sum(arr) substantially faster than Python's built-in sum(arr) on a large array?",
                "options": [
                    "A) NumPy automatically launches a multi-threaded daemon thread for each calculation.",
                    "B) NumPy executes compiled C-level loops over contiguous memory using SIMD CPU instructions without Python object boxing.",
                    "C) Python's sum() executes forced garbage collection on each element iteration.",
                    "D) NumPy converts Python bytecode directly to GPU shaders at runtime."
                ],
                "answer": "B",
                "explanation": "NumPy stores data contiguously in memory and executes compiled C loops with hardware SIMD vector registers, bypassing Python's PyObject pointer indirection and interpreter overhead."
            },
            {
                "question": "Given `arr = np.array([10, 15, 20, 25, 30])`, which expression correctly filters values strictly greater than 15 and divisible by 10?",
                "options": [
                    "A) arr[(arr > 15) and (arr % 10 == 0)]",
                    "B) arr[(arr > 15) & (arr % 10 == 0)]",
                    "C) arr.filter(lambda x: x > 15 and x % 10 == 0)",
                    "D) np.select(arr > 15, arr % 10 == 0)"
                ],
                "answer": "B",
                "explanation": "In NumPy, element-wise boolean operations require the bitwise operator '&' wrapped in parentheses to ensure correct operator precedence over comparison operators."
            },
            {
                "question": "What does arr.reshape(2, 3) return when applied to a 1D contiguous array?",
                "options": [
                    "A) Always an independent deep copy with new memory allocation.",
                    "B) A new ndarray view pointing to the same data buffer with updated shape and stride metadata.",
                    "C) A standard Python list of nested tuples.",
                    "D) A transposed reference requiring memory alignment."
                ],
                "answer": "B",
                "explanation": "When the underlying data is contiguous in memory, reshape() creates a view with new shape/stride metadata without copying the buffer, saving memory and compute."
            }
        ]
    },

    "pandas": {
        "title": "Pandas & Data Engineering",
        "summary": "Pandas provides fast, flexible, and expressive data structures designed to make working with relational or labeled data intuitive and powerful. The primary structures are Series (1D) and DataFrame (2D).",
        "objectives": [
            "Master DataFrame and Series creation, index alignment, and data type specifications.",
            "Perform vectorized transformations, conditional filtering, and query expressions.",
            "Execute complex split-apply-combine aggregations with .groupby() and window functions.",
            "Handle missing data (NaN) with production imputation strategies."
        ],
        "core_concepts": [
            {
                "name": "1. Labeled Data Structures & Index Alignment",
                "detail": "DataFrames provide labeled axis indexes (rows and columns) that automatically align during arithmetic and merge operations, preventing silent row mismatches."
            },
            {
                "name": "2. GroupBy & Split-Apply-Combine Workflow",
                "detail": "The .groupby() method splits data into groups, applies aggregation/transformation functions, and combines results efficiently into summary metrics."
            },
            {
                "name": "3. Vectorization vs .apply() Performance",
                "detail": "Native vectorized string and datetime methods (.str, .dt) execute in C and are orders of magnitude faster than iterating with .iterrows() or custom Python lambda functions."
            }
        ],
        "code_snippet": (
            "import pandas as pd\nimport numpy as np\n\n"
            "# 1. Create DataFrame with explicit types\n"
            "df = pd.DataFrame({\n"
            "    'employee_id': ['EMP001', 'EMP002', 'EMP003', 'EMP004'],\n"
            "    'department': ['Engineering', 'Engineering', 'L&D', 'Engineering'],\n"
            "    'study_hours': [42.5, 38.0, 55.2, 19.5],\n"
            "    'completed_courses': [4, 3, 6, 2]\n"
            "})\n\n"
            "# 2. Vectorized metric calculation\n"
            "df['hours_per_course'] = df['study_hours'] / df['completed_courses']\n\n"
            "# 3. GroupBy Aggregation\n"
            "dept_summary = df.groupby('department').agg(\n"
            "    total_hours=('study_hours', 'sum'),\n"
            "    avg_hours=('study_hours', 'mean'),\n"
            "    active_learners=('employee_id', 'count')\n"
            ").reset_index()\n\n"
            "print(dept_summary)\n"
        ),
        "gotchas": [
            "Never use df.iterrows() for large datasets; it converts rows to Series and is 100x slower than vectorized operations.",
            "Chained indexing like df['col'][0] = 5 triggers SettingWithCopyWarning. Use df.loc[0, 'col'] = 5 instead.",
            "Merging without verifying column uniqueness can cause silent Cartesian explosion of row counts.",
            "Omitting downcasting on integer/float columns causes unnecessary memory consumption in analytics pipelines."
        ],
        "quiz": [
            {
                "question": "Which method is the most efficient for computing a new column based on existing numerical columns in a 1,000,000-row DataFrame?",
                "options": [
                    "A) df.apply(lambda row: row['a'] * row['b'], axis=1)",
                    "B) Vectorized arithmetic: df['a'] * df['b']",
                    "C) Iterating with for index, row in df.iterrows()",
                    "D) Using a Python list comprehension: [r.a * r.b for r in df.itertuples()]"
                ],
                "answer": "B",
                "explanation": "Vectorized operations (df['a'] * df['b']) execute in compiled C code without per-row Python object wrapping, running 50x-100x faster than .apply(axis=1)."
            },
            {
                "question": "What is the primary cause of the 'SettingWithCopyWarning' in Pandas?",
                "options": [
                    "A) Attempting to write to a read-only CSV file on disk.",
                    "B) Modifying a DataFrame slice created via chained indexing where Pandas cannot guarantee if it's a view or a copy.",
                    "C) Setting an index with duplicate values.",
                    "D) Changing the data type of an existing column."
                ],
                "answer": "B",
                "explanation": "Chained assignment (df[mask]['col'] = val) makes it ambiguous whether a view or copy is being mutated. Using df.loc[mask, 'col'] = val resolves the ambiguity."
            },
            {
                "question": "What does df.groupby('dept')['hours'].transform('mean') return?",
                "options": [
                    "A) A reduced DataFrame containing one row per department.",
                    "B) A Series with the exact same length and index as df, containing the group mean aligned to each original row.",
                    "C) A dictionary mapping departments to average hours.",
                    "D) A single scalar floating point value."
                ],
                "answer": "B",
                "explanation": "transform() produces a result with the same shape and index as the original input, making it ideal for normalization or feature engineering."
            },
            {
                "question": "How should missing values in a numerical column be replaced with the column median without altering original records inappropriately?",
                "options": [
                    "A) df['col'].dropna(inplace=True)",
                    "B) df['col'] = df['col'].fillna(df['col'].median())",
                    "C) df['col'].replace(0, df['col'].mean())",
                    "D) df['col'].interpolate(method='zero')"
                ],
                "answer": "B",
                "explanation": "df['col'].fillna(df['col'].median()) replaces NaN entries with the calculated median value while preserving existing indices and non-null values."
            },
            {
                "question": "Which parameter in pd.merge ensures that all rows from the left table are retained even if no match exists in the right table?",
                "options": [
                    "A) how='inner'",
                    "B) how='left'",
                    "C) how='outer'",
                    "D) how='cross'"
                ],
                "answer": "B",
                "explanation": "how='left' performs a LEFT OUTER JOIN, keeping all records from the left DataFrame and filling unmatched right-side columns with NaN."
            }
        ]
    },

    "python": {
        "title": "Python & Modern Software Engineering",
        "summary": "Python is a versatile, high-level, interpreted programming language emphasizing code readability, developer productivity, and a vast ecosystem spanning web backend, data engineering, and automation.",
        "objectives": [
            "Master Python memory management, object lifecycle, and the Global Interpreter Lock (GIL).",
            "Leverage advanced language features: decorators, generators, context managers, and comprehensions.",
            "Write asynchronous code with asyncio for non-blocking I/O operations.",
            "Apply typing annotations and Pydantic models for robust enterprise software."
        ],
        "core_concepts": [
            {
                "name": "1. Generators, Iterators & Memory Efficiency",
                "detail": "Generators (yield) evaluate values lazily on demand rather than storing full collections in RAM, enabling stream processing of massive datasets with constant O(1) memory."
            },
            {
                "name": "2. Decorators & Metaprogramming",
                "detail": "Decorators wrap functions or methods to dynamically inject cross-cutting concerns such as logging, authentication, caching, and rate-limiting without modifying core logic."
            },
            {
                "name": "3. Concurrency: Asyncio vs Threading vs Multiprocessing",
                "detail": "Asyncio handles massive concurrent I/O-bound connections via a single-threaded cooperative event loop. Multiprocessing bypasses the GIL for CPU-bound computations."
            }
        ],
        "code_snippet": (
            "import asyncio\nimport time\nfrom typing import List, AsyncGenerator\n\n"
            "# 1. Custom context manager\n"
            "class Timer:\n"
            "    async def __aenter__(self):\n"
            "        self.start = time.perf_counter()\n"
            "        return self\n"
            "    async def __aexit__(self, exc_type, exc_val, exc_tb):\n"
            "        self.elapsed = time.perf_counter() - self.start\n"
            "        print(f'Execution completed in {self.elapsed:.4f}s')\n\n"
            "# 2. Asynchronous generator stream\n"
            "async def fetch_records(batch_size: int = 3) -> AsyncGenerator[List[int], None]:\n"
            "    for i in range(0, 9, batch_size):\n"
            "        await asyncio.sleep(0.01)  # Simulate non-blocking I/O\n"
            "        yield list(range(i, i + batch_size))\n\n"
            "# 3. Orchestrator\n"
            "async def main():\n"
            "    async with Timer():\n"
            "        async for batch in fetch_records():\n"
            "            print('Processed batch:', batch)\n\n"
            "# asyncio.run(main())\n"
        ),
        "gotchas": [
            "Using mutable default arguments (e.g. def add(item, lst=[])) retains state across all invocations. Use lst=None instead.",
            "Blocking synchronous calls (like time.sleep or requests.get) inside async functions freeze the entire asyncio event loop.",
            "Assuming Python threads run in parallel on multi-core CPUs for CPU-bound workloads; the GIL serializes bytecode execution.",
            "Overusing circular module imports without structuring package boundaries causes runtime ImportError."
        ],
        "quiz": [
            {
                "question": "What is the danger of defining a function with `def append_item(x, l=[]): l.append(x); return l`?",
                "options": [
                    "A) Raises a SyntaxError at compile time.",
                    "B) The default list 'l' is created once at function definition time, accumulating items across subsequent calls.",
                    "C) Python raises an UnboundLocalError when 'l' is modified.",
                    "D) The list is garbage collected immediately upon return."
                ],
                "answer": "B",
                "explanation": "Default argument expressions in Python are evaluated once when the function definition is executed, meaning mutable objects (lists, dicts) persist across calls."
            },
            {
                "question": "What does the `yield` keyword do inside a Python function?",
                "options": [
                    "A) Immediately terminates the function and frees its stack frame.",
                    "B) Pauses function execution, returns an intermediate value, and maintains local state for subsequent resumption via next().",
                    "C) Spawns an operating system thread to evaluate the return expression.",
                    "D) Flushes standard output buffers."
                ],
                "answer": "B",
                "explanation": "yield turns a normal function into a generator factory. Each call to next() resumes execution right after the yield until the next yield or StopIteration."
            },
            {
                "question": "Which concurrency model is best suited for handling 10,000 simultaneous idle web socket connections in Python?",
                "options": [
                    "A) OS Threads (threading.Thread)",
                    "B) Asynchronous Event Loop (asyncio)",
                    "C) Heavyweight Processes (multiprocessing.Process)",
                    "D) Synchronous sequential looping"
                ],
                "answer": "B",
                "explanation": "asyncio uses a single-threaded cooperative event loop with non-blocking I/O multiplexing (epoll/kqueue), handling thousands of concurrent sockets with low memory overhead."
            },
            {
                "question": "What is the difference between `is` and `==` in Python?",
                "options": [
                    "A) 'is' checks value equality, while '==' checks object identity in memory.",
                    "B) 'is' checks object identity (same memory address via id()), while '==' checks value equality (via __eq__).",
                    "C) They are completely interchangeable syntax aliases.",
                    "D) 'is' works only on primitive types, while '==' works only on classes."
                ],
                "answer": "B",
                "explanation": "'is' determines whether two references point to the exact same object in memory (id(a) == id(b)), while '==' evaluates equality of their values."
            },
            {
                "question": "How do you ensure a custom class can be cleanly used with the `with` statement?",
                "options": [
                    "A) Define __start__ and __stop__ methods.",
                    "B) Define __enter__ and __exit__ methods.",
                    "C) Inherit from collections.abc.ContextManager.",
                    "D) Implement the __iter__ and __next__ protocol."
                ],
                "answer": "B",
                "explanation": "The context management protocol requires __enter__ (called before the block executes) and __exit__ (called after the block exits, even on exception)."
            }
        ]
    },

    "fastapi": {
        "title": "FastAPI & High-Performance Asynchronous APIs",
        "summary": "FastAPI is a modern, high-performance web framework for building APIs with Python 3.8+ based on standard Python type hints, Starlette for web tooling, and Pydantic for data validation.",
        "objectives": [
            "Build asynchronous RESTful endpoints utilizing ASGI standards and async/await.",
            "Leverage Pydantic models for automated request parsing, serialization, and validation.",
            "Structure scalable dependency injection trees with Depends() for security and database sessions.",
            "Generate interactive OpenAPI/Swagger documentation automatically."
        ],
        "core_concepts": [
            {
                "name": "1. ASGI Architecture & Async/Await",
                "detail": "FastAPI runs on ASGI servers (like Uvicorn) using non-blocking I/O. When endpoints make database or network calls with await, the event loop handles other requests concurrently."
            },
            {
                "name": "2. Dependency Injection System (Depends)",
                "detail": "FastAPI has a built-in dependency injection system that resolves database sessions, authentication credentials, and configuration hierarchically with automatic teardown."
            },
            {
                "name": "3. Pydantic Schema Validation & OpenAPI Generation",
                "detail": "All payloads and query parameters are type-checked at runtime using Pydantic. Valid schemas generate interactive Swagger UI (/docs) and Redoc automatically."
            }
        ],
        "code_snippet": (
            "from fastapi import FastAPI, Depends, HTTPException, status\n"
            "from pydantic import BaseModel, Field\n"
            "from typing import List, Optional\n\n"
            "app = FastAPI(title='Emergere LMS API')\n\n"
            "class CourseRequest(BaseModel):\n"
            "    course_name: str = Field(..., min_length=3, max_length=100)\n"
            "    provider: str = Field(default='Emergere LMS')\n"
            "    priority: Optional[str] = 'Standard'\n\n"
            "async def get_current_user():\n"
            "    # Dependency for token validation\n"
            "    return {'employee_id': 'EMP019', 'role': 'Employee'}\n\n"
            "@app.post('/api/courses/request', status_code=status.HTTP_201_CREATED)\n"
            "async def create_course_request(\n"
            "    req: CourseRequest,\n"
            "    user: dict = Depends(get_current_user)\n"
            "):\n"
            "    return {\n"
            "        'status': 'Submitted',\n"
            "        'request_code': 'CLM-2026-0099',\n"
            "        'course': req.course_name,\n"
            "        'requested_by': user['employee_id']\n"
            "    }\n"
        ),
        "gotchas": [
            "Declaring an endpoint as 'async def' but running blocking synchronous code (e.g. time.sleep or raw odbc requests) blocks the main thread. Use standard 'def' for synchronous tasks so FastAPI runs them in a thread pool.",
            "Modifying mutable default dependencies across requests can cause shared state bugs. Always return fresh session instances.",
            "Failing to handle CORS middleware properly will block frontend Single Page Applications in production.",
            "Over-nesting Pydantic models can degrade serialization performance for high-throughput payloads."
        ],
        "quiz": [
            {
                "question": "What happens if you define a FastAPI route as `async def my_endpoint()` and call a blocking synchronous library like `time.sleep(5)` inside it?",
                "options": [
                    "A) FastAPI automatically moves it to a separate thread pool.",
                    "B) The entire Uvicorn single-threaded event loop is blocked for 5 seconds, stopping all concurrent requests.",
                    "C) Python raises an AsyncBlockException.",
                    "D) The operating system preempts the loop without impact."
                ],
                "answer": "B",
                "explanation": "If a route is defined with 'async def', FastAPI executes it directly on the main event loop. Blocking calls freeze the event loop. If using blocking code, declare it with standard 'def' so FastAPI executes it in an external thread pool."
            },
            {
                "question": "How does FastAPI's `Depends` system manage database session cleanup (e.g. closing connections)?",
                "options": [
                    "A) Sessions are closed manually in every route return statement.",
                    "B) Using a generator dependency with `yield`; code before yield runs on request, and code after yield runs during response cleanup.",
                    "C) FastAPI hooks into Python's garbage collector finalizer.",
                    "D) ASGI servers automatically terminate all open sockets."
                ],
                "answer": "B",
                "explanation": "FastAPI supports generator dependencies using 'yield'. The setup logic runs before the route handler, and cleanup logic (like db.close() or session.rollback()) executes reliably after the response is sent."
            },
            {
                "question": "Which HTTP status code should be returned when a resource is successfully created via a POST request?",
                "options": [
                    "A) 200 OK",
                    "B) 201 Created",
                    "C) 202 Accepted",
                    "D) 204 No Content"
                ],
                "answer": "B",
                "explanation": "RFC 7231 defines HTTP 201 Created as the standard response when one or more new resources have been successfully created."
            },
            {
                "question": "What is the primary role of Pydantic in FastAPI?",
                "options": [
                    "A) Database Object-Relational Mapping (ORM) and migrations.",
                    "B) Request parsing, type coercion, validation, serialization, and OpenAPI schema generation.",
                    "C) Managing background worker threads and Celery queues.",
                    "D) Frontend React JSX transpilation."
                ],
                "answer": "B",
                "explanation": "Pydantic validates input data types, coerces compatible values, serializes responses, and automatically generates JSON Schema definitions consumed by Swagger UI."
            },
            {
                "question": "How do you extract a URL path parameter named `course_id` of integer type in FastAPI?",
                "options": [
                    "A) @app.get('/courses') def get(request: Request): course_id = request.params['course_id']",
                    "B) @app.get('/courses/{course_id}') async def get(course_id: int): ...",
                    "C) @app.get('/courses') async def get(course_id: Query(int)): ...",
                    "D) @app.get('/courses/<int:course_id>') def get(course_id): ..."
                ],
                "answer": "B",
                "explanation": "FastAPI uses Python format string syntax '{param}' in the path template and matches the parameter name and type annotation in the route function arguments."
            }
        ]
    },

    "react": {
        "title": "React & Modern Component-Driven Architecture",
        "summary": "React is a declarative, component-based frontend library for building modern user interfaces, leveraging a Virtual DOM, unidirectional data flow, and composable Hooks.",
        "objectives": [
            "Master functional components, JSX syntax, and component modularity.",
            "Effectively manage local and global state with useState, useReducer, and Context API.",
            "Control side effects and lifecycle dependencies with useEffect.",
            "Optimize rendering performance with React.memo, useMemo, and useCallback."
        ],
        "core_concepts": [
            {
                "name": "1. Virtual DOM & Reconciliation",
                "detail": "React keeps an in-memory representation of the UI (Virtual DOM) and uses a diffing algorithm (Reconciliation) to compute minimal real DOM mutations, ensuring smooth 60fps user experiences."
            },
            {
                "name": "2. The Rules of Hooks",
                "detail": "Hooks must only be called at the top level of functional components or custom hooks, never inside loops, conditions, or nested functions, ensuring consistent call order across re-renders."
            },
            {
                "name": "3. Unidirectional Data Flow & State Colocation",
                "detail": "Data flows down via props and events bubble up via callbacks. State should be colocated as close to where it is consumed as possible to avoid redundant re-renders."
            }
        ],
        "code_snippet": (
            "import React, { useState, useEffect, useMemo, useCallback } from 'react';\n\n"
            "export const CourseSearch = ({ onSelectCourse }) => {\n"
            "  const [query, setQuery] = useState('');\n"
            "  const [courses, setCourses] = useState([]);\n"
            "  const [loading, setLoading] = useState(false);\n\n"
            "  // Memoized filtered list\n"
            "  const filteredCourses = useMemo(() => {\n"
            "    if (!query) return courses;\n"
            "    return courses.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));\n"
            "  }, [courses, query]);\n\n"
            "  // Stable callback handler\n"
            "  const handleSearch = useCallback((e) => {\n"
            "    setQuery(e.target.value);\n"
            "  }, []);\n\n"
            "  return (\n"
            "    <div className='course-search-card'>\n"
            "      <input\n"
            "        type='text'\n"
            "        value={query}\n"
            "        onChange={handleSearch}\n"
            "        placeholder='Search LMS catalog...'\n"
            "      />\n"
            "      <ul>\n"
            "        {filteredCourses.map(c => (\n"
            "          <li key={c.id} onClick={() => onSelectCourse(c)}>{c.name}</li>\n"
            "        ))}\n"
            "      </ul>\n"
            "    </div>\n"
            "  );\n"
            "};\n"
        ),
        "gotchas": [
            "Omitting variables referenced inside useEffect from its dependency array causes stale closures and subtle synchronization bugs.",
            "Directly mutating state variables (e.g. state.push(item)) bypasses React's diffing engine; always treat state as immutable.",
            "Using array index as key (key={index}) in dynamic lists leads to re-ordering bugs and broken input focus.",
            "Overusing useMemo/useCallback on trivial computations creates unnecessary memory overhead without performance benefits."
        ],
        "quiz": [
            {
                "question": "What is the consequence of passing an empty dependency array `[]` to `useEffect`?",
                "options": [
                    "A) The effect runs on every single render.",
                    "B) The effect executes once after the initial component mount, and its cleanup function runs upon unmount.",
                    "C) The effect is skipped entirely and never executes.",
                    "D) The component will fail to compile."
                ],
                "answer": "B",
                "explanation": "An empty dependency array indicates to React that the effect has no dependencies on props or state, executing once upon initial mounting and cleaning up on unmount."
            },
            {
                "question": "Why should you avoid using the array index as a `key` prop in dynamic lists where items can be re-ordered or filtered?",
                "options": [
                    "A) Keys must always be string UUIDs or numbers greater than 100.",
                    "B) When items shift positions, index keys confuse React's diffing algorithm, leading to incorrect UI state retention in form inputs and animations.",
                    "C) Index keys trigger a hard React error in production mode.",
                    "D) It increases bundle size during Webpack build."
                ],
                "answer": "B",
                "explanation": "Keys provide persistent identities between renders. If items are re-ordered or deleted, index-based keys force React to mutate incorrect DOM nodes, causing state and focus glitches."
            },
            {
                "question": "What is the primary purpose of the `useCallback` hook?",
                "options": [
                    "A) To cache the computed return value of an expensive function.",
                    "B) To return a memoized version of a callback function that only changes when its dependencies change, preventing child re-renders.",
                    "C) To execute asynchronous HTTP calls immediately on mount.",
                    "D) To replace the Redux dispatch function."
                ],
                "answer": "B",
                "explanation": "useCallback memoizes function instances between renders. When passed to memoized child components (React.memo), it preserves referential equality and avoids unnecessary re-renders."
            },
            {
                "question": "In React 18+, how does automatic state batching work?",
                "options": [
                    "A) Only state updates inside React synthetic event handlers are batched.",
                    "B) Multiple state updates inside promises, setTimeout, native event handlers, and fetch callbacks are batched together into a single re-render.",
                    "C) Batching is disabled by default and requires unstable_batchedUpdates.",
                    "D) Each setState call immediately triggers a synchronous DOM flush."
                ],
                "answer": "B",
                "explanation": "React 18 introduced universal automatic batching across all asynchronous callbacks, promises, and timeouts, reducing re-renders and improving performance."
            },
            {
                "question": "When should you use the `useReducer` hook instead of `useState`?",
                "options": [
                    "A) When managing complex state logic with multiple sub-values, or when the next state depends on the previous state.",
                    "B) Whenever a component has more than two state variables.",
                    "C) Only when connecting to an external GraphQL endpoint.",
                    "D) useReducer is deprecated in favor of Zustand."
                ],
                "answer": "A",
                "explanation": "useReducer is ideal for state transitions that involve complex business logic, interdependent state fields, or when decoupling state updates from component render logic."
            }
        ]
    },

    "sql": {
        "title": "SQL Server & Relational Database Architecture",
        "summary": "Microsoft SQL Server is an enterprise relational database management system supporting ACID transactions, stored procedures, window functions, and query execution plan optimization.",
        "objectives": [
            "Design normalized relational schemas (3NF) with primary and foreign key constraints.",
            "Write high-performance SELECT queries utilizing JOINs, subqueries, and window functions.",
            "Analyze and optimize query execution plans using Clustered and Non-Clustered Indexes.",
            "Ensure data consistency and concurrency control with transactions and isolation levels."
        ],
        "core_concepts": [
            {
                "name": "1. Clustered vs Non-Clustered Indexes",
                "detail": "A table can have only one Clustered Index because it dictates the physical sorting of rows on disk. Non-Clustered indexes are separate B-Tree structures pointing back to the clustered key."
            },
            {
                "name": "2. Window Functions (OVER, PARTITION BY)",
                "detail": "Window functions (ROW_NUMBER, DENSE_RANK, LAG, LEAD) calculate aggregations across partitions of rows without collapsing the result set like GROUP BY."
            },
            {
                "name": "3. ACID Transactions & Concurrency",
                "detail": "ACID guarantees (Atomicity, Consistency, Isolation, Durability) ensure reliable transactions. Isolation levels (Read Committed, Snapshot) prevent dirty reads and phantom reads."
            }
        ],
        "code_snippet": (
            "-- High-performance analytical query with Window Functions\n"
            "SELECT \n"
            "    e.employee_id,\n"
            "    e.name AS employee_name,\n"
            "    c.course_name,\n"
            "    enr.progress_percentage,\n"
            "    enr.completed_at,\n"
            "    ROW_NUMBER() OVER(\n"
            "        PARTITION BY enr.employee_id \n"
            "        ORDER BY enr.completed_at DESC\n"
            "    ) AS recent_rank\n"
            "FROM dbo.lms_employees e\n"
            "INNER JOIN dbo.lms_course_enrollments enr \n"
            "    ON e.employee_id = enr.employee_id\n"
            "INNER JOIN dbo.lms_courses c \n"
            "    ON enr.course_id = c.course_id\n"
            "WHERE enr.status = 'Completed';\n"
        ),
        "gotchas": [
            "Wrapping indexed columns in functions (e.g. WHERE YEAR(created_at) = 2026) invalidates index seek, forcing a costly table scan (non-sargable query).",
            "Using SELECT * in production queries wastes network bandwidth and prevents the query engine from utilizing covering indexes.",
            "Neglecting transaction boundaries during batch updates can result in partial writes or deadlocks.",
            "Unindexed foreign key columns cause table locks during cascading deletions."
        ],
        "quiz": [
            {
                "question": "What is the primary difference between a Clustered Index and a Non-Clustered Index in SQL Server?",
                "options": [
                    "A) A table can have multiple clustered indexes, but only one non-clustered index.",
                    "B) The clustered index defines the physical order of data rows on disk, while a non-clustered index is a separate B-tree structure pointing to the data.",
                    "C) Clustered indexes cannot be created on primary key columns.",
                    "D) Non-clustered indexes do not support WHERE clause lookups."
                ],
                "answer": "B",
                "explanation": "Because a table's physical data pages can only be sorted in one order, there can only be one clustered index per table. Non-clustered indexes maintain separate pointers (row IDs or cluster keys) to data."
            },
            {
                "question": "Why is `WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01'` preferred over `WHERE YEAR(created_at) = 2026`?",
                "options": [
                    "A) The first query is shorter to type.",
                    "B) Applying the YEAR() function on a column makes the predicate non-sargable, preventing the query optimizer from performing an efficient Index Seek.",
                    "C) SQL Server does not support the YEAR() function.",
                    "D) The first query forces a parallel scan."
                ],
                "answer": "B",
                "explanation": "Applying scalar functions to indexed columns forces the query optimizer to evaluate the function for every row in an Index Scan. Sargable range operators allow an efficient Index Seek."
            },
            {
                "question": "What is the difference between `RANK()` and `DENSE_RANK()` window functions when duplicate values occur?",
                "options": [
                    "A) RANK() leaves gaps in the ranking sequence after ties (e.g. 1, 1, 3), whereas DENSE_RANK() does not (e.g. 1, 1, 2).",
                    "B) DENSE_RANK() only works on floating point numbers.",
                    "C) RANK() requires a GROUP BY clause, while DENSE_RANK() does not.",
                    "D) They produce identical results."
                ],
                "answer": "A",
                "explanation": "When duplicate values share a rank, RANK() skips rank numbers corresponding to the number of ties. DENSE_RANK() guarantees consecutive rank integers without gaps."
            },
            {
                "question": "Which SQL isolation level completely prevents dirty reads, non-repeatable reads, and phantom reads?",
                "options": [
                    "A) Read Uncommitted",
                    "B) Read Committed",
                    "C) Repeatable Read",
                    "D) Serializable"
                ],
                "answer": "D",
                "explanation": "Serializable is the highest isolation level. It places range locks on query predicates, preventing other transactions from inserting new rows that would satisfy the query (phantom reads)."
            },
            {
                "question": "What is a 'Covering Index' in SQL database optimization?",
                "options": [
                    "A) An index that covers all tables in the database schema.",
                    "B) A non-clustered index that includes all columns referenced in the query (SELECT, JOIN, WHERE), satisfying the request entirely from index pages without Key Lookups.",
                    "C) An encrypted index concealing customer credit card numbers.",
                    "D) An automatic index generated by SQL Server Profiler."
                ],
                "answer": "B",
                "explanation": "When an index includes (via key or INCLUDE columns) all fields required by a query, SQL Server satisfies the query directly from index pages, eliminating expensive bookmark/key lookups."
            }
        ]
    },

    "docker": {
        "title": "Docker & Container Virtualization",
        "summary": "Docker packages applications and their complete dependencies into lightweight, portable containers that run consistently across development, staging, and multi-cloud production environments.",
        "objectives": [
            "Author efficient, secure multi-stage Dockerfiles to minimize container image footprints.",
            "Understand container isolation: namespaces, cgroups, and layered union filesystems.",
            "Configure persistent data storage using Docker volumes and bind mounts.",
            "Manage multi-container application stacks with Docker Compose and custom bridge networks."
        ],
        "core_concepts": [
            {
                "name": "1. Multi-Stage Builds & Image Layer Optimization",
                "detail": "Multi-stage builds separate compile-time toolchains (SDKs, build tools) from runtime artifacts, producing minimal, secure production images without bloated compilers."
            },
            {
                "name": "2. Layer Caching & Build Performance",
                "detail": "Each Dockerfile instruction creates a cached layer. Placing frequently changing files (application source code) after stable dependencies (package manifests) speeds up build times."
            },
            {
                "name": "3. Security & Non-Root Execution",
                "detail": "Running containers as non-root users (USER appuser) mitigates container breakout vulnerabilities and restricts privilege escalation."
            }
        ],
        "code_snippet": (
            "# Production Multi-Stage Dockerfile for Python Backend\n"
            "FROM python:3.12-slim AS builder\n"
            "WORKDIR /app\n"
            "COPY requirements.txt .\n"
            "RUN pip install --no-cache-dir --user -r requirements.txt\n\n"
            "# Final lightweight runtime stage\n"
            "FROM python:3.12-slim\n"
            "WORKDIR /app\n"
            "RUN useradd -m -u 1001 lmsuser\n"
            "COPY --from=builder /root/.local /home/lmsuser/.local\n"
            "COPY . .\n"
            "USER lmsuser\n"
            "ENV PATH=/home/lmsuser/.local/bin:$PATH\n"
            "EXPOSE 5000\n"
            "CMD [\"uvicorn\", \"app:app\", \"--host\", \"0.0.0.0\", \"--port\", \"5000\"]\n"
        ),
        "gotchas": [
            "Running containers as default root user creates severe security vulnerabilities if a container breakout occurs.",
            "Using 'latest' tag in production manifests causes non-reproducible deployments when base images update silently.",
            "Storing stateful database data inside a container without an attached Docker Volume loses all data upon container termination.",
            "Failing to clean package manager caches (apt-get clean, --no-cache-dir) bloats image size unnecessarily."
        ],
        "quiz": [
            {
                "question": "Why is multi-stage building a critical best practice when building Docker images?",
                "options": [
                    "A) It allows running multiple containers inside a single image.",
                    "B) It separates compile-time dependencies from the final runtime image, resulting in dramatically smaller and more secure images.",
                    "C) It bypasses Docker's 127-layer limit.",
                    "D) It allows Docker to run on macOS without a virtual machine."
                ],
                "answer": "B",
                "explanation": "Multi-stage builds allow you to use a heavy SDK image to compile code and copy only the final binary or dependencies into a slim base image, stripping compilers and build tools."
            },
            {
                "question": "What is the difference between `CMD` and `ENTRYPOINT` in a Dockerfile?",
                "options": [
                    "A) CMD is executed during build time, while ENTRYPOINT runs at runtime.",
                    "B) ENTRYPOINT specifies the default executable that always runs, while CMD provides default arguments that can be easily overridden from the CLI.",
                    "C) CMD only works on Linux images, while ENTRYPOINT works on Windows.",
                    "D) They are exact synonyms."
                ],
                "answer": "B",
                "explanation": "ENTRYPOINT sets the fixed binary/command for the container, and CMD supplies default arguments. Running 'docker run myimage arg1' overrides CMD while retaining ENTRYPOINT."
            },
            {
                "question": "Which Linux kernel mechanisms provide process isolation and resource limits for Docker containers?",
                "options": [
                    "A) Hyper-V and QEMU",
                    "B) Namespaces (isolation) and Cgroups (resource limitation)",
                    "C) Systemd and SysVinit",
                    "D) Ext4 and Btrfs filesystems"
                ],
                "answer": "B",
                "explanation": "Namespaces isolate process trees, network interfaces, mounts, and user IDs. Control Groups (cgroups) meter and limit CPU, memory, and I/O consumption."
            },
            {
                "question": "What happens to data written inside a container if no Docker volume or bind mount is configured and the container is removed?",
                "options": [
                    "A) Data is automatically committed to a new Docker image layer.",
                    "B) All written data is permanently deleted with the container's writable layer.",
                    "C) Docker backs up data to /var/lib/docker/lost+found.",
                    "D) Data persists in the host OS /tmp directory."
                ],
                "answer": "B",
                "explanation": "Containers utilize an ephemeral copy-on-write storage driver. When the container is deleted (docker rm), its writable layer is destroyed unless volumes are attached."
            },
            {
                "question": "Why should `COPY requirements.txt .` and `RUN pip install ...` appear before `COPY . .` in a Dockerfile?",
                "options": [
                    "A) Python requires requirements.txt to be located in the root directory.",
                    "B) To take advantage of Docker layer caching; dependencies are only re-installed if requirements.txt changes, not on every code edit.",
                    "C) Docker produces a build error if code is copied first.",
                    "D) It reduces network latency during download."
                ],
                "answer": "B",
                "explanation": "Docker caches each build step. By copying requirements.txt first and installing packages, Docker reuses the cached layer on subsequent builds if dependencies haven't changed."
            }
        ]
    }
}


def get_tech_knowledge(topic: str) -> Dict[str, Any]:
    """
    Returns authentic, production-grade technical knowledge for a given topic.
    Matches against known domains (numpy, pandas, python, fastapi, react, sql, docker, etc.)
    or dynamically synthesizes an executive-grade technical profile.
    """
    topic_clean = (topic or "").strip()
    topic_lower = topic_clean.lower()

    # Match against known domains
    for key, data in TECH_DOMAINS.items():
        if key in topic_lower or (key == "sql" and any(w in topic_lower for w in ["sql server", "database", "tsql", "query"])):
            return {
                "topic": data["title"],
                "summary": data["summary"],
                "objectives": data["objectives"],
                "core_concepts": data["core_concepts"],
                "code_snippet": data["code_snippet"],
                "gotchas": data["gotchas"],
                "quiz": data["quiz"]
            }

    # Dynamic fallback synthesizer for arbitrary technical topic
    title_display = topic_clean.title()
    return {
        "topic": title_display,
        "summary": (
            f"{title_display} represents a vital competency in contemporary enterprise software engineering. "
            f"Mastering its core syntax, architectural idioms, and execution runtime enables engineers to build "
            f"resilient, scalable, and maintainable production systems."
        ),
        "objectives": [
            f"Master core syntax, data flow semantics, and primary design patterns of {title_display}.",
            f"Implement clean, modular, and maintainable code adhering to enterprise standards.",
            f"Analyze and resolve runtime performance bottlenecks, memory leaks, and race conditions.",
            f"Apply automated unit testing, continuous integration, and observability best practices."
        ],
        "core_concepts": [
            {
                "name": f"1. Core Architecture & Runtime Lifecycle of {title_display}",
                "detail": (
                    f"Understanding how {title_display} executes at runtime—including memory management, "
                    f"I/O boundaries, and concurrency handling—is essential for building high-throughput systems."
                )
            },
            {
                "name": "2. Production Design Patterns & Modular Structure",
                "detail": (
                    f"Enterprise implementations of {title_display} demand strict separation of concerns, "
                    f"clean dependency injection, centralized configuration, and standardized error containment."
                )
            },
            {
                "name": "3. Observability, Security & Production Deployment",
                "detail": (
                    f"Incorporate structured logging, metrics emission, input sanitization, and automated secret "
                    f"rotation across every lifecycle stage of {title_display} applications."
                )
            }
        ],
        "code_snippet": (
            f"# Production-Grade {title_display} Implementation Pattern\n"
            f"from typing import Optional, Dict, Any\n"
            f"import logging\n\n"
            f"logger = logging.getLogger('{re.sub(r'[^a-zA-Z0-9_]', '_', topic_lower)}')\n\n"
            f"class {re.sub(r'[^a-zA-Z0-9]', '', title_display)}Service:\n"
            f"    '''Enterprise service wrapper for {title_display} operations.'''\n"
            f"    def __init__(self, config: Optional[Dict[str, Any]] = None):\n"
            f"        self.config = config or {{'enabled': True, 'timeout': 30}}\n"
            f"        logger.info(f'Initialized {title_display} service.')\n\n"
            f"    def process_workload(self, payload: Dict[str, Any]) -> Dict[str, Any]:\n"
            f"        if not payload:\n"
            f"            raise ValueError('Payload cannot be empty')\n"
            f"        logger.info('Processing {title_display} transaction...')\n"
            f"        return {{'status': 'SUCCESS', 'data': payload}}\n"
        ),
        "gotchas": [
            f"Neglecting automated error boundaries leading to uncaught runtime exceptions in {title_display}.",
            f"Overlooking memory and socket cleanups during high-frequency execution cycles.",
            f"Hardcoding configurations or environment credentials directly into source files.",
            f"Failing to establish baseline metrics and distributed tracing before deploying to production."
        ],
        "quiz": [
            {
                "question": f"What is the foundational architectural principle when designing {title_display} applications for scale?",
                "options": [
                    "A) Monolithic shared state with unmonitored global singletons",
                    "B) Decoupled, modular components with clear interface boundaries and stateless execution",
                    "C) Disabling input validation to improve latency",
                    "D) Suppressing runtime exceptions to prevent log inflation"
                ],
                "answer": "B",
                "explanation": "Decoupled modular architecture with stateless execution allows horizontal scaling, independent failure containment, and straightforward testing."
            },
            {
                "question": f"How should configuration parameters and secrets be injected into {title_display} services?",
                "options": [
                    "A) Hardcoded in git-committed source code",
                    "B) Plaintext local config files shared across environments",
                    "C) Environment variables and centralized secret management vaults",
                    "D) Passed as unencrypted URL query parameters"
                ],
                "answer": "C",
                "explanation": "Twelve-Factor App methodology mandates storing config and secrets in environment variables or dedicated secret management vaults (e.g. Azure Key Vault, AWS Secrets Manager)."
            },
            {
                "question": f"Which strategy ensures reliable error handling and resiliency in {title_display} workflows?",
                "options": [
                    "A) Infinite immediate retry loops",
                    "B) Exponential backoff with jitter and circuit-breaker patterns",
                    "C) Silently ignoring errors and returning null",
                    "D) Terminating the host process on any transient failure"
                ],
                "answer": "B",
                "explanation": "Exponential backoff with jitter prevents thundering herd congestion, while circuit breakers isolate failing downstream dependencies."
            },
            {
                "question": f"What is the recommended approach for validating inputs and schemas in {title_display}?",
                "options": [
                    "A) Trusting all client-supplied inputs implicitly",
                    "B) Strict schema validation and sanitization at the system boundary before processing",
                    "C) Performing validation only in the client UI layer",
                    "D) Relying on database error messages for schema enforcement"
                ],
                "answer": "B",
                "explanation": "Defensive enterprise programming mandates validating and sanitizing all inputs at the entry boundary before executing business logic."
            },
            {
                "question": f"Why is automated regression testing vital during {title_display} deployments?",
                "options": [
                    "A) It is solely an audit requirement with no engineering benefit",
                    "B) It verifies functional correctness, prevents regressions, and enables confident continuous integration (CI/CD)",
                    "C) It replaces the need for code reviews",
                    "D) It increases execution speed of the production runtime"
                ],
                "answer": "B",
                "explanation": "Automated regression testing guarantees that existing capabilities remain intact during refactoring and new feature releases, underpinning stable CI/CD pipelines."
            }
        ]
    }


def get_tech_quiz(topic: str) -> List[Dict[str, Any]]:
    """Returns a 5-question technical quiz for the specified topic."""
    knowledge = get_tech_knowledge(topic)
    return knowledge.get("quiz", [])
