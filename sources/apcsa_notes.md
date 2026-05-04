# AP CSA  -  CSAwesome 2 Study Notes

## Unit 1

*Unit overview*
This unit builds the Java basics that everything else depends on: program structure, variables, primitive types, expressions, assignment, casting, methods, objects, constructors, `String`, and `Math`. By the end, you should be able to read small Java programs, predict expression values, understand how object references work, and use the AP Java Quick Reference methods without guessing.

*What to be able to do*
- Trace variable values through assignment, arithmetic, casting, increment, and compound assignment.
- Distinguish primitive values from object references, including `null`.
- Read and write method calls with parameters, return values, overloading, and static methods.
- Create objects with `new`, call constructors, and call instance methods.
- Use `String` methods, `Math` methods, concatenation, and basic random integer expressions.

*algorithm*
A finite, ordered sequence of steps that solves a problem. Built from sequencing, selection, and repetition.

*pseudocode*
A simplified, language-agnostic sketch of an algorithm written in plain English (or diagrams) before coding.

*sequencing*
Steps run in order, one at a time, top-to-bottom.

*Java is object-oriented*
Every Java program is written inside a `class`; classes and the objects created from them are the basic building blocks.

*IDE*
Integrated Development Environment  -  editor + compiler + runner in one tool (e.g. IntelliJ, Eclipse, Replit).

*minimum Java program*
```java
public class MyClass
{
    public static void main(String[] args)
    {
        System.out.println("Hi there!");
    }
}
```

*class header*
`public class NameOfClass { }`  -  file must be named `NameOfClass.java` (case-sensitive).

*main method*
`public static void main(String[] args) { }`  -  entry point automatically run by the JVM.

*println vs print*
`System.out.println(x)` prints then advances to a new line; `System.out.print(x)` does not.

*statement terminator*
Every Java statement ends with `;`. Blocks of code are wrapped in `{ }`.

*compiler*
Translates `.java` source into `.class` bytecode and reports syntax errors. Bytecode runs on the JVM.

*syntax error*
Violates Java grammar (missing `;`, unmatched `{}`, unclosed `""`). Caught by the compiler  -  must fix to run.

*logic error*
Code compiles and runs but produces wrong output. Detected by testing.

*run-time error*
Crashes the program during execution (e.g. division by zero, null deref).

*exception*
A run-time error object thrown when something unexpected happens. Common ones: `ArithmeticException`, `NullPointerException`, `ArrayIndexOutOfBoundsException`, `IndexOutOfBoundsException`, `InputMismatchException`, `IOException`, `FileNotFoundException`, `ConcurrentModificationException`.

*variable*
A named memory location that stores a value that can change while the program runs.

*data type*
A set of values together with the operations defined on them. Either *primitive* (value stored directly) or *reference* (variable stores address of an object).

*the three primitive types on the AP exam*

| type | holds | size | example |
|---|---|---|---|
| `int` | whole numbers | 32 bits | `42`, `-7` |
| `double` | decimal numbers | 64 bits | `3.14`, `-0.5` |
| `boolean` | `true` / `false` | 1 bit logically | `true` |

*String*
Reference type (a class in `java.lang`). A sequence of characters in double quotes: `"Hello"`.

*declaring a variable*
```java
int score;          // declare
score = 4;          // initialize
double gpa = 3.5;   // declare + initialize
```

*naming rules*
Start with a letter, contain letters/digits/`_`, no spaces, not a keyword. Use `camelCase` and meaningful names.

*case sensitivity*
`gameScore` and `gamescore` are different variables.

*never put a variable inside `""`*
```java
int score = 0;
System.out.println("score");      // prints the literal text "score"
System.out.println("score=" + score); // prints score=0
```

*string concatenation*
The `+` operator joins strings; if either operand is a `String`, the other is converted to `String` (calls its `toString` for objects).
```java
String name = "Jose";
System.out.println("Hi " + name);  // Hi Jose  -  note the space inside quotes
```

*literal*
A fixed value written directly in code: `42`, `3.14`, `"hi"`, `true`.

*string literal*
Zero or more characters between two double quotes: `""`, `"a"`, `"hello"`.

*escape sequences*

| sequence | meaning |
|---|---|
| `\"` | double quote inside a string |
| `\\` | backslash |
| `\n` | newline |

*arithmetic operators*

| op | meaning | `7 ? 2` |
|---|---|---|
| `+` | add | 9 |
| `-` | subtract | 5 |
| `*` | multiply | 14 |
| `/` | divide | 3 (int) / 3.5 (double) |
| `%` | remainder (modulo) | 1 |

*int division throws away the remainder*
```java
int x = 7 / 2;      // 3, NOT 3.5
double y = 7 / 2;   // still 3.0  -  the division happens as ints first
double z = 7.0 / 2; // 3.5  -  at least one double => double division
```

*modulo for divisibility & digit extraction*
```java
n % 2 == 0   // even
n % 10       // last digit of n
n / 10       // n with last digit removed
```

*operator precedence*
`*`, `/`, `%` before `+`, `-`. Equal precedence evaluates left-to-right. Use `()` to force order.

*ArithmeticException*
Integer division by zero throws `ArithmeticException`. (Double division by zero gives `Infinity` or `NaN`.)

*assignment operator*
`=` stores the value of the expression on the right into the variable on the left. Variable must be on the left.
```java
score = 4;     // OK
4 = score;     // ERROR
```

*compound assignment operators*

| op | equivalent |
|---|---|
| `x += 5` | `x = x + 5` |
| `x -= 5` | `x = x - 5` |
| `x *= 2` | `x = x * 2` |
| `x /= 2` | `x = x / 2` |
| `x %= 3` | `x = x % 3` |

*increment / decrement*
```java
x++;   // x = x + 1
x--;   // x = x - 1
```
*the AP exam never uses prefix `++x` / `--x` and never uses `x++` in a context where the expression's value matters.*

*type casting*
```java
(int) 3.9       // 3  -  truncates (drops the .9), does NOT round
(double) 5      // 5.0
(int)(x + 0.5)  // round positive double x to nearest int
(int)(x - 0.5)  // round negative double x to nearest int
```

*implicit widening (int -> double)*
```java
double avg = sum / count;     // if sum, count are ints, division is int! avg loses precision
double avg = (double) sum / count; // forces double division
```

*Integer.MAX_VALUE / Integer.MIN_VALUE*
Largest/smallest possible `int` (~±2.1 billion). Going past these wraps around (**integer overflow**  -  result is silently wrong, no exception).

*round-off error*
`double` has finite precision, so `0.1 + 0.2 != 0.3` exactly. Round to needed precision or use `int` for money (in cents).

*comments*

| syntax | use |
|---|---|
| `// line` | single-line comment |
| `/* block */` | multi-line comment |
| `/** javadoc */` | API documentation comment |

*precondition*
A condition that must be true *before* the method runs (caller's responsibility  -  method does not check it).

*postcondition*
A condition guaranteed to be true *after* the method runs (description of result / state changes).

*method*
A named block of code that runs only when called. Lets you reuse code (procedural abstraction).

*block of code*
Any section of code enclosed in braces `{ }` (e.g. a class body, method body, loop body, `if` body).

*method signature*
The method name plus the ordered list of parameter types. Used to identify the method.

*method header*
```java
public static returnType methodName(paramType paramName, ...)
```

*parameter vs argument*
**Parameter** = the variable declared in the method header. **Argument** = the actual value passed in when calling.

*call by value*
Java copies the argument into the parameter. For primitives, modifying the parameter does NOT affect the caller's variable.

*overloading*
Two methods with the same name but different parameter lists (different number, type, or order). Return type alone does NOT overload.

*void method*
Returns nothing. Cannot be used in an expression  -  only as a standalone statement.

*non-void method*
Returns a value matching its return type. Must be used (assigned, printed, or in expression)  -  otherwise the value is lost.
```java
double r = Math.sqrt(9);          // assign
System.out.println(Math.sqrt(9)); // print
double a = Math.sqrt(9) + 1;      // expression
```

*return statement*
```java
return expression;   // sends a value back, exits the method immediately
```
Code after `return` is unreachable.

*static (class) method*
A method that belongs to the class, not an instance. Called as `ClassName.methodName(...)`. Inside the same class you can drop the class name.
```java
public static int square(int n) { return n * n; }
// call:
int s = MyClass.square(5);  // or just square(5) inside MyClass
```

*Math class*
Static utility class in `java.lang` (auto-imported). Always called as `Math.method(...)`.

*Math methods on the AP reference sheet*

| method | returns |
|---|---|
| `Math.abs(int)` | absolute value as `int` |
| `Math.abs(double)` | absolute value as `double` |
| `Math.pow(double, double)` | first arg raised to power of second, as `double` |
| `Math.sqrt(double)` | positive square root, as `double` |
| `Math.random()` | `double` in `[0.0, 1.0)` (1.0 not included) |

*Math examples*
```java
Math.abs(-45);     // 45
Math.pow(2, 3);    // 8.0
Math.sqrt(9);      // 3.0
Math.random();     // e.g. 0.7349...
```

*random int in a range*
```java
// random int in [0, 10)  -> 0..9
int r = (int)(Math.random() * 10);
// random int in [1, 10]  -> 1..10
int r = (int)(Math.random() * 10) + 1;
// random int in [min, max]
int r = (int)(Math.random() * (max - min + 1)) + min;
```

*class*
A blueprint that defines a new reference data type. Specifies the *attributes* (data) and *behaviors* (methods) of objects of that class.

*object*
A specific instance of a class. Has its own copy of the instance variables.

*reference*
A reference variable holds the address of an object (not the object itself). `null` means "no object".
```java
String s;        // declared, value is null
s = "hi";        // s now references a String object
```

*attribute / instance variable*
Data the object knows about itself (e.g. a `Turtle`'s color or position).

*behavior / method*
What an object can do (e.g. a `Turtle`'s `forward(100)`).

*class hierarchy*
Common attributes/behaviors live in a *superclass*; *subclasses* `extends` it to inherit them. All classes ultimately extend `Object`. Designing inheritance is out-of-scope for AP CSA.

*constructor*
A special method called with `new` that creates and initializes an object. Same name as the class. **No return type.**
```java
Turtle t = new Turtle(world);    // calls Turtle(World) constructor
```

*the `new` keyword*
`new ClassName(args)` allocates memory for a new object, runs the matching constructor, and evaluates to a *reference* to that object.

*constructor signature*
Constructor name (= class name) + ordered list of parameter types.

*overloaded constructors*
Multiple constructors in the same class with different signatures.

*no-argument constructor*
Constructor that takes no parameters: `new Turtle()`.

*null reference*
The literal `null` means "no object". Calling a method on `null` throws `NullPointerException`.

*calling instance methods*
Use the dot operator: `objectName.methodName(args)`.
```java
String s = "hello";
int n = s.length();         // 5
String u = s.substring(1);  // "ello"
```

*method call interrupts execution*
When you call a method, control jumps into it; when the method returns (or finishes), control resumes after the call site.

*libraries and APIs*
A **library** is a collection of pre-written classes. Its **API** documents how to use them. Classes are grouped into **packages**; `import` makes them available.

*automatic imports*
`java.lang` is imported automatically (`String`, `Math`, `Integer`, `Double`, `System`, `Object`).

*String creation*
```java
String a = "Hello";                  // string literal (preferred)
String b = new String("Hello");      // constructor (rare)
```

*String immutability*
A `String` cannot be changed after creation. Methods like `substring`, `concat`, `+` return a *new* `String`; the original is unchanged.

*string concatenation rules*
`+` between two Strings → new String. `+` between a String and any other type → other is converted to String (primitives by their textual form, objects via `toString()`).

*concatenation evaluates left-to-right*
```java
"12" + 4 + 3   // → "1243"  (string + int → string, then string + int → string)
4 + 3 + "12"   // → "712"   (int + int → 7, then 7 + string → "712")
```

*String indexing*
First character is at index 0, last at `length() - 1`. Out-of-range index throws `IndexOutOfBoundsException`.

*String methods on the AP reference sheet*

| signature | returns |
|---|---|
| `String(String str)` | constructs a copy of `str` |
| `int length()` | number of characters |
| `String substring(int from, int to)` | chars from index `from` up to (not including) `to` |
| `String substring(int from)` | from `from` to end of string |
| `int indexOf(String str)` | index of first occurrence of `str`, or `-1` if not found |
| `boolean equals(String other)` | content equality |
| `int compareTo(String other)` | <0 if less, 0 if equal, >0 if greater (alphabetic order) |

*never compare Strings with `==`*
```java
"hi".equals(other)       // RIGHT  -  content
"hi" == other            // wrong  -  compares references
"hi".compareTo(other)    // for ordering
```

*get a single character as a substring*
```java
str.substring(i, i + 1)  // single-character String at index i
```

*Scanner (text input  -  not on AP exam, but used in coursework)*
```java
import java.util.Scanner;
Scanner input = new Scanner(System.in);
int n = input.nextInt();
String s = input.nextLine();
```

*the nextInt / nextLine buffer trap*
```java
int n = input.nextInt();      // reads "1", leaves "\n" in buffer
String s = input.nextLine();  // gobbles the leftover "\n", returns ""!
```
*if reading a string after a number, call an extra `input.nextLine();` to consume the newline.*

## Unit 2

*Unit overview*
This unit is about control flow: choosing which code runs and repeating code correctly. The main exam skill is tracing, especially with nested conditionals, boolean logic, loops, string traversal, nested loops, and standard accumulator or search patterns. Most mistakes come from off-by-one bounds, early returns, skipped updates, and boolean expressions that are not equivalent.

*What to be able to do*
- Evaluate relational and logical expressions, including short-circuit behavior and De Morgan's Laws.
- Trace `if`, `else if`, nested `if`, `while`, `for`, and nested loop code.
- Convert between common `for` and `while` structures.
- Use standard loop algorithms: count, sum, average, min, max, search, and digit processing.
- Traverse strings by index and predict output from nested loops.

*selection*
A program decides between alternative paths based on a boolean test.

*repetition / iteration*
A program runs a section of code multiple times.

*relational operators*

| op | meaning |
|---|---|
| `==` | equal to |
| `!=` | not equal to |
| `<` | less than |
| `>` | greater than |
| `<=` | less than or equal |
| `>=` | greater than or equal |

*relational result is a boolean*
```java
boolean isAdult = age >= 18;
```

*== vs .equals*
For primitives `==` compares values. For reference types `==` compares *references* (whether they point to the same object); use `.equals(...)` for content comparison.

*divisibility check*
```java
if (n % 2 == 0)   // n is even
if (n % 3 == 0)   // n is a multiple of 3
```

*if statement*
```java
if (booleanExpression)
{
    // executes when expression is true
}
```

*if-else*
```java
if (booleanExpression)
{
    // when true
}
else
{
    // when false
}
```

*if-else-if (multi-way)*
```java
if (score >= 90)        grade = 'A';
else if (score >= 80)   grade = 'B';
else if (score >= 70)   grade = 'C';
else                    grade = 'F';
```
*at most one branch runs  -  the first whose condition is true.*

*nested if*
An `if` inside another `if`. The inner condition is only evaluated if the outer condition is true.

*dangling else*
An `else` always pairs with the nearest unmatched `if`. Use `{ }` to make grouping explicit.

*missing braces gotcha*
```java
if (cond)
    doA();
    doB();   // ALWAYS runs  -  not actually inside the if!
```

*logical operators*

| op | name | true when |
|---|---|---|
| `!a` | NOT | `a` is false |
| `a && b` | AND | both `a` and `b` are true |
| `a \|\| b` | OR | `a` or `b` (or both) are true |

*precedence of logical operators*
`!` before `&&` before `||`. Use parentheses to override.

*short-circuit evaluation*
`&&` stops at the first `false`; `||` stops at the first `true`. The right side is not evaluated.
```java
if (s != null && s.length() > 0)   // safe  -  short-circuits if s is null
```

*De Morgan's Laws*
```java
!(a && b)   ==   !a || !b
!(a || b)   ==   !a && !b
```

*negating relationals*

| original | equivalent |
|---|---|
| `!(c == d)` | `c != d` |
| `!(c != d)` | `c == d` |
| `!(c < d)`  | `c >= d` |
| `!(c > d)`  | `c <= d` |
| `!(c <= d)` | `c > d` |
| `!(c >= d)` | `c < d` |

*equivalent boolean expressions*
Two expressions are equivalent iff they produce the same value for every combination of inputs (provable with truth tables).

*aliases*
Two reference variables that point to the same object. `==` between them is true.
```java
String a = new String("hi");
String b = a;     // alias  -  a == b is true
```

*null check*
`obj == null` and `obj != null` test whether a reference points to an object.

*custom equals*
A class can override `equals(Object other)` to define content equality based on its attributes.

*while loop*
```java
int count = 0;                // 1. initialize
while (count < 10)            // 2. test
{
    System.out.println(count);
    count++;                  // 3. update
}
```
*runs zero or more times  -  condition is checked before every iteration.*

*loop control variable*
The variable used in the loop's condition. Must be initialized, tested, and updated.

*infinite loop*
Boolean condition is always true. Forgetting to update the loop variable is the most common cause.

*off-by-one error*
Loop runs one too many or one too few times  -  usually `<` vs `<=` or wrong start index.

*sentinel-controlled loop*
Reads input until a special value (e.g. `-1` or `"quit"`) appears. Not on the AP exam but useful.

*for loop*
```java
for (initialize; test; update)
{
    // body
}
// equivalent while:
initialize;
while (test) { body; update; }
```

*for loop execution order*
1. initialization (once),
2. test → if false exit,
3. body,
4. update,
5. go to 2.

*standard counting for loops*
```java
for (int i = 0; i < n; i++)   // 0..n-1, runs n times
for (int i = 1; i <= n; i++)  // 1..n, runs n times
for (int i = n - 1; i >= 0; i--) // count down
```

*for ↔ while equivalence*
Any `for` loop can be rewritten as a `while` (and vice versa).

*standard loop algorithms*

| pattern | example |
|---|---|
| sum / accumulator | `for (...) sum += a[i];` |
| average | sum then `sum / count` (cast to double) |
| min / max | track running best in a variable |
| count matching | `if (cond) count++;` inside loop |
| divisibility | use `%` |
| digit extraction | `n % 10` then `n /= 10` until `n == 0` |

*accumulator pattern*
```java
int sum = 0;
for (int i = 0; i < nums.length; i++)
{
    sum += nums[i];
}
```

*find min/max*
```java
int min = nums[0];
for (int i = 1; i < nums.length; i++)
{
    if (nums[i] < min) min = nums[i];
}
```

*digit extraction*
```java
int n = 1234;
while (n > 0)
{
    int digit = n % 10;   // 4, 3, 2, 1
    n /= 10;
}
```

*string traversal with a loop*
```java
for (int i = 0; i < s.length(); i++)
{
    String ch = s.substring(i, i + 1);
    // ...
}
```

*standard string algorithms*

| task | technique |
|---|---|
| count occurrences of a char | loop + `substring(i, i+1).equals(target)` |
| reverse a string | accumulate `result = ch + result;` |
| check substring property | `indexOf(sub) != -1` |

*build a reversed string*
```java
String result = "";
for (int i = 0; i < s.length(); i++)
{
    result = s.substring(i, i + 1) + result;
}
```

*nested loops*
A loop inside another loop. The inner loop completes all its iterations for each single iteration of the outer loop.
```java
for (int r = 0; r < rows; r++)
{
    for (int c = 0; c < cols; c++)
    {
        // runs rows * cols times total
    }
}
```

*statement execution count*
The number of times a statement is executed. Used for informal runtime analysis.

*counting iterations*
A loop that goes from `lo` to `hi` (inclusive) runs `hi - lo + 1` times.

*nested loop iteration count*
Outer iterations × inner iterations (when inner is independent of outer).

*non-rectangular nested loops*
When inner range depends on outer index, total iterations follow `n(n+1)/2` for triangular shapes.
```java
for (int i = 0; i < n; i++)
    for (int j = 0; j < i; j++)   // 0+1+2+...+(n-1) = n(n-1)/2
        ...
```

*trace table*
A grid listing each variable's value after each iteration  -  used to predict loop output by hand.

## Unit 3

*Unit overview*
This unit focuses on writing and reasoning about classes. The key idea is that an object owns state through private instance variables and exposes behavior through constructors and methods. You should be comfortable tracing constructor calls, accessor and mutator methods, parameter passing, aliasing, `this`, `static`, scope, and the difference between changing an object and reassigning a reference.

*What to be able to do*
- Identify instance variables, constructors, accessor methods, mutator methods, and helper methods.
- Trace object state through method calls and constructor execution.
- Explain how primitive parameters, object parameters, and returned references behave.
- Use `this` to resolve shadowing and understand when it is unavailable.
- Distinguish instance members from `static` members and apply scope rules.

*abstraction*
Hiding irrelevant detail and focusing on the main idea. Reduces complexity.

*data abstraction*
Naming a piece of data (variable / class / set) without exposing how it's stored.

*procedural abstraction*
Naming a process (a method) so callers can use it without knowing its implementation.

*method decomposition*
Breaking a large behavior into smaller helper methods.

*encapsulation*
Keeping the internal data of a class hidden from outside code, exposed only through methods.

*public vs private*

| keyword | visible from |
|---|---|
| `public` | anywhere |
| `private` | only inside the declaring class |

*conventions*
Classes are `public`. Constructors are `public`. Instance variables are `private`.

*anatomy of a class*
```java
public class Student
{
    // instance variables (state)  -  private
    private String name;
    private int gradeLevel;

    // constructor(s)
    public Student(String n, int g)
    {
        name = n;
        gradeLevel = g;
    }

    // methods (behavior)
    public String getName() { return name; }
    public void setGradeLevel(int g) { gradeLevel = g; }
}
```

*has-a relationship*
A `Student` *has-a* `name` and *has-a* `gradeLevel`  -  defined by the instance variables.

*object state*
The current values of all instance variables.

*default values for instance variables*

| type | default |
|---|---|
| `int` | `0` |
| `double` | `0.0` |
| `boolean` | `false` |
| any reference type | `null` |

*default constructor*
If you write *no* constructors at all, Java provides a free `public ClassName()` that initializes everything to its default value. **Once you write any constructor, the default constructor is no longer provided.**

*constructor purpose*
Allocate memory for the object, return its reference, and set initial values for instance variables.

*constructor with parameters*
```java
public Student(String n, int g)
{
    name = n;
    gradeLevel = g;
}
```

*constructor parameters use call-by-value*
Primitive arguments are copied. Object arguments copy the *reference* (both names point to the same object).

*defensive copy of mutable parameter*
```java
public StudentList(ArrayList<String> names)
{
    // copy so external changes can't mutate our state
    this.names = new ArrayList<String>(names);
}
```

*void method*
```java
public void setName(String n) { name = n; }
```

*non-void method*
```java
public int getGrade() { return gradeLevel; }
```

*return by value*
A non-void method returns a single value (primitive copy or object reference).

*return statement halts the method*
Code after `return` (whether inside an `if`, a loop, or just sequentially) does not execute.

*accessor (getter)*
Non-void method that returns the value of an instance variable.
```java
public String getName() { return name; }
```

*mutator (setter)*
Usually void, changes an instance variable.
```java
public void setName(String n) { name = n; }
```

*toString*
Override to give a String representation. Auto-called by `print`/`println` and string concatenation.
```java
public String toString()
{
    return name + " (grade " + gradeLevel + ")";
}
```

*passing primitive vs object as parameter*
Primitive: parameter holds a copy  -  caller's value never changes. Object: parameter holds a copy of the reference  -  method can mutate the same object via that reference (but reassigning the parameter does NOT change the caller's reference).

*returning a reference returns the alias*
```java
public ArrayList<String> getNames() { return names; }
// caller gets a reference to the ACTUAL list  -  they can mutate it
```
*if you want to protect internal state, return a defensive copy.*

*private method/data of a parameter*
A method can access the private fields of a parameter only if the parameter's type is the same class as the enclosing method.

*static / class variable*
Belongs to the class itself, not to any one object  -  all instances share one copy. Declared with `static`.
```java
public class Student
{
    private static int numStudents = 0;
    public Student() { numStudents++; }
}
```

*public static variable access*
```java
Math.PI;             // ClassName.staticVar
Integer.MAX_VALUE;
```

*static method*
Belongs to the class. Cannot access instance variables / instance methods directly (no `this`). Can access other static members.
```java
public static int getCount() { return numStudents; }
// call as Student.getCount();
```

*final*
A `final` variable cannot be reassigned after initialization. Used for constants:
```java
public static final double PI = 3.14159;
```

*scope*
The region of code where a variable is accessible.

*local variable*
Declared inside a method, constructor, or block. Visible only within that block.

*parameter scope*
Parameters are local variables of the method/constructor  -  visible only inside it.

*shadowing*
A local variable / parameter with the same name as an instance variable hides the instance variable inside that method body.
```java
public void setName(String name)
{
    name = name;       // BUG! both names refer to the parameter
}
```

*this keyword*
Inside an instance method or constructor, `this` is a reference to the current object.
```java
public void setName(String name)
{
    this.name = name;  // this.name is the instance variable; name is the parameter
}
```

*this as an argument*
```java
otherObj.compare(this);   // pass current object to another method
```

*static methods have no `this`*
You cannot use `this` inside a static method.

*why `main` is static*
The JVM calls `main` before any object exists, so it must belong to the class itself.

*common static-context error*
Trying to use an instance variable/method from a static method gives:
```
non-static variable cannot be referenced from a static context
```
Fix: pass an object as a parameter, or make the member static too.

## Unit 4

*Unit overview*
This unit covers collections, files, searching, sorting, two-dimensional arrays, and recursion tracing. The most important exam work is indexed traversal: choosing correct bounds, knowing whether an operation changes a collection, and recognizing standard algorithms in unfamiliar code. You should also know when an exception happens and how algorithm behavior changes with sorted versus unsorted data.

*What to be able to do*
- Traverse arrays, `ArrayList` objects, and 2D arrays with correct indices and loop bounds.
- Apply standard collection algorithms: sum, average, min, max, count, search, insert, delete, shift, and reverse.
- Choose safe removal patterns for `ArrayList` and avoid enhanced-for modification errors.
- Trace file input patterns that use `Scanner`, `hasNext`, `next`, `nextLine`, and `split`.
- Recognize linear search, binary search, selection sort, insertion sort, merge sort, and recursive traces.

*data set*
A collection of related pieces of data. Analyzed by accessing values one at a time.

*array*
A fixed-size, indexed collection of values of the same type. Length set at creation, cannot change.

*declaring an array*
```java
int[] scores;            // declares  -  value is null
double[] prices;
String[] names;
```

*creating an array with `new`*
```java
int[] scores = new int[5];           // length 5, all zeros
String[] names = new String[10];     // length 10, all null
double[] p;
p = new double[3];                   // declare then create
```

*default array element values*

| element type | default |
|---|---|
| `int` | `0` |
| `double` | `0.0` |
| `boolean` | `false` |
| reference type | `null` |

*initializer list*
```java
int[] nums = {1, 2, 3, 4, 5};       // length is 5, no `new` needed
String[] days = {"Mon", "Tue", "Wed"};
```

*accessing elements*
```java
nums[0]            // first element
nums[nums.length - 1]   // last element
nums[2] = 99;      // assignment
```

*length attribute*
```java
nums.length        // NO parens  -  it's a field, not a method (unlike String.length())
```

*index out of range*
Valid indices: `0` through `nums.length - 1`. Out-of-range access throws `ArrayIndexOutOfBoundsException`.

*standard for loop traversal*
```java
for (int i = 0; i < nums.length; i++)
{
    System.out.println(nums[i]);
}
```

*while loop traversal*
```java
int i = 0;
while (i < nums.length)
{
    System.out.println(nums[i]);
    i++;
}
```

*enhanced for loop (for-each)*
```java
for (int val : nums)
{
    System.out.println(val);
}
```
*read as "for each `val` in `nums`".*

*enhanced for loop limits*
- The loop variable is a *copy*  -  assigning to it does NOT change the array element.
- You don't have access to the index.
- For an array of objects, you CAN call mutator methods on the loop variable (it references the same object).

*don't modify array structure with enhanced for*
Don't try to assign `val = newVal;` expecting the array to update.

*standard array algorithms*

| task | sketch |
|---|---|
| sum | `for (int v : a) sum += v;` |
| average | sum then `(double) sum / a.length` |
| min/max | track running best |
| count matches | increment on match |
| any matches | return true on first match |
| all match | return false on first failure |
| linear search | return index on first match, `-1` if none |
| reverse traversal | start at `length - 1`, go to `0` |

*find with early return  -  common bug*
```java
for (int v : array)
{
    if (v == target) return true;
    else return false;            // BUG! returns after first element
}
return false;
```
*correct:*
```java
for (int v : array)
{
    if (v == target) return true;
}
return false;     // only after checking every element
```

*reverse traversal*
```java
for (int i = a.length - 1; i >= 0; i--)
{
    System.out.println(a[i]);
}
```

*off-by-one in reverse loop  -  common bug*
```java
for (int i = a.length; i >= 0; i--)   // a[a.length] is OUT OF BOUNDS
```

*File class*
```java
import java.io.*;
File f = new File("data.txt");
```

*throws IOException*
```java
public static void main(String[] args) throws IOException
{
    File f = new File("data.txt");
    Scanner s = new Scanner(f);
    ...
}
```
*if the file doesn't exist, the program throws `FileNotFoundException` (a subtype of `IOException`).*

*Scanner with a File*
```java
import java.io.*;
import java.util.*;

public static void main(String[] args) throws IOException
{
    Scanner scan = new Scanner(new File("data.txt"));
    while (scan.hasNext())
    {
        String line = scan.nextLine();
        System.out.println(line);
    }
    scan.close();
}
```

*Scanner methods on the AP reference sheet*

| method | returns |
|---|---|
| `Scanner(File f)` | constructs Scanner reading from `f` |
| `int nextInt()` | next `int`; throws `InputMismatchException` if not an int |
| `double nextDouble()` | next `double` |
| `boolean nextBoolean()` | next `boolean` |
| `String nextLine()` | rest of current line as `String` (or `""` if just after `nextInt`/`nextDouble`); `null` if no next line |
| `String next()` | next whitespace-delimited token |
| `boolean hasNext()` | `true` if more input remains |
| `void close()` | close the input stream |

*hasNext loop*
```java
while (scan.hasNext())
{
    String line = scan.nextLine();
    // process
}
scan.close();
```

*always close the file*
Call `scan.close()` after reading to release the resource.

*split a String*
```java
String csv = "Alice,16,A";
String[] fields = csv.split(",");   // ["Alice", "16", "A"]
```
`String[] split(String del)`  -  splits along matches of `del` and returns the pieces.

*reading CSV row-by-row*
```java
while (scan.hasNext())
{
    String line = scan.nextLine();
    String[] data = line.split(",");
    String name = data[0];
    int age = Integer.parseInt(data[1]);
    ...
}
```

*wrapper classes*
`Integer` wraps `int`, `Double` wraps `double`. Both are immutable, both live in `java.lang`. Used because collections (like `ArrayList`) hold *objects*, not primitives.

*autoboxing*
Java automatically converts `int` → `Integer` (and `double` → `Double`) when assigning to / passing as the wrapper type.
```java
ArrayList<Integer> nums = new ArrayList<Integer>();
nums.add(5);          // autobox: 5 -> Integer.valueOf(5)
```

*unboxing*
Java automatically converts `Integer` → `int` (and `Double` → `double`) when assigning to / passing as the primitive type.
```java
int n = nums.get(0);  // unbox
```

*parseInt / parseDouble*
```java
int n = Integer.parseInt("42");        // 42
double d = Double.parseDouble("3.14"); // 3.14
```
Throws `NumberFormatException` if the string doesn't represent a number.

*ArrayList*
Resizable list of object references. Part of `java.util`.
```java
import java.util.ArrayList;
ArrayList<String> names = new ArrayList<String>();
```

*generic type `<E>`*
The type in angle brackets specifies what the list holds. Without it, the list holds `Object`. Always use the typed form so the compiler can catch errors.
```java
ArrayList<Integer> nums = new ArrayList<Integer>();
```

*ArrayList cannot hold primitives*
You must use wrapper classes: `ArrayList<Integer>`, `ArrayList<Double>`. Autoboxing handles the conversion.

*ArrayList methods on the AP reference sheet*

| method | does |
|---|---|
| `int size()` | number of elements |
| `boolean add(E obj)` | append `obj`; returns `true` |
| `void add(int index, E obj)` | insert at `index`; shifts later elements right |
| `E remove(int index)` | remove at `index`; shifts later elements left; returns the removed element |
| `E get(int index)` | element at `index` |
| `E set(int index, E obj)` | replace at `index`; returns the old element |

*ArrayList vs array*

| feature | array | ArrayList |
|---|---|---|
| size | fixed at creation | grows / shrinks |
| length | `arr.length` (field) | `list.size()` (method) |
| access | `arr[i]` | `list.get(i)` |
| set | `arr[i] = v` | `list.set(i, v)` |
| primitives | yes | no  -  wrapper classes |
| 2D | yes | nested ArrayLists (rare on exam) |
| index error | `ArrayIndexOutOfBoundsException` | `IndexOutOfBoundsException` |

*ArrayList traversal  -  for loop*
```java
for (int i = 0; i < list.size(); i++)
{
    String s = list.get(i);
    ...
}
```

*ArrayList traversal  -  enhanced for*
```java
for (String s : list)
{
    System.out.println(s);
}
```

*ConcurrentModificationException*
Modifying the size of an ArrayList (`add` or `remove`) while iterating with an enhanced for loop throws this. Use an indexed for loop if you need to remove.

*deleting during traversal  -  gotcha*
After `remove(i)`, the next element shifts down to index `i`. If you `i++`, you skip an element.
```java
// CORRECT  -  only increment when you didn't remove
int i = 0;
while (i < list.size())
{
    if (shouldRemove(list.get(i)))
        list.remove(i);
    else
        i++;
}
```
*alternative: iterate from end to start so removals don't affect remaining indices.*

*standard ArrayList algorithms*
Same family as array algorithms (min/max, sum/average, count, search, reverse, shift, rotate, dedupe, insert, delete)  -  replace `arr[i]` with `list.get(i)` and `arr.length` with `list.size()`.

*traversing two collections in parallel*
```java
for (int i = 0; i < a.size(); i++)
{
    if (a.get(i).equals(b.get(i))) ...
}
```

*2D array*
An array of arrays  -  declared as `type[][]`. Stored row-by-row.

*declaring/creating a 2D array*
```java
int[][] grid = new int[3][4];   // 3 rows, 4 columns; all 0
String[][] board;
board = new String[8][8];
```

*2D initializer list*
```java
int[][] arr = { {1, 2, 3},
                {4, 5, 6} };    // 2 rows, 3 cols
```

*accessing 2D elements*
```java
arr[row][col]            // first index = row, second = column
arr[1][2] = 99;
```

*length of a 2D array*

| expression | meaning |
|---|---|
| `arr.length` | number of rows |
| `arr[0].length` | number of columns (length of row 0) |
| `arr[r].length` | length of row `r` (always same since rectangular for AP) |

*row-major traversal (standard)*
```java
for (int row = 0; row < arr.length; row++)
{
    for (int col = 0; col < arr[0].length; col++)
    {
        System.out.println(arr[row][col]);
    }
}
```

*column-major traversal*
```java
for (int col = 0; col < arr[0].length; col++)
{
    for (int row = 0; row < arr.length; row++)
    {
        System.out.println(arr[row][col]);
    }
}
```

*enhanced for over a 2D array*
```java
// outer var is a row (1D array); inner var is one element
for (int[] row : arr)
{
    for (int val : row)
    {
        System.out.println(val);
    }
}
```

*accessing one row as a 1D array*
```java
int[] firstRow = arr[0];
```

*2D out-of-bounds*
Invalid `row` or `col` throws `ArrayIndexOutOfBoundsException`.

*2D defaults match 1D defaults*
`new int[2][3]` is filled with `0`; `new String[2][3]` is filled with `null`.

*standard 2D algorithms*
sum/average/min/max of all entries, of one row, of one column; row/column with largest sum; transpose; search for value (linear search applied to each row); count matches.

*linear search*
Check each element in order until target found or end reached. Works on unsorted data. Returns the index (or `-1`).
```java
public static int linearSearch(int[] a, int target)
{
    for (int i = 0; i < a.length; i++)
    {
        if (a[i] == target) return i;
    }
    return -1;
}
```

*linear search on 2D array*
Linear search each row.

*binary search*
Requires data already sorted. Examines the middle element; if not the target, eliminates half the array and repeats. Far faster than linear search for large arrays.
```java
public static int binarySearch(int[] a, int target)
{
    int lo = 0, hi = a.length - 1;
    while (lo <= hi)
    {
        int mid = (lo + hi) / 2;
        if (a[mid] == target) return mid;
        else if (a[mid] < target) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}
```

*binary search facts*
- Requires sorted data.
- More efficient than linear search.
- Can be written iteratively or recursively.

*selection sort*
Repeatedly find the minimum of the unsorted portion and swap it into the next sorted position.
```java
public static void selectionSort(int[] a)
{
    for (int j = 0; j < a.length - 1; j++)
    {
        int minIndex = j;
        for (int k = j + 1; k < a.length; k++)
        {
            if (a[k] < a[minIndex]) minIndex = k;
        }
        int temp = a[j];
        a[j] = a[minIndex];
        a[minIndex] = temp;
    }
}
```

*insertion sort*
Take each element and insert it into the correct position in the already-sorted left portion (shifting larger elements right).
```java
public static void insertionSort(int[] a)
{
    for (int j = 1; j < a.length; j++)
    {
        int temp = a[j];
        int possibleIndex = j;
        while (possibleIndex > 0 && temp < a[possibleIndex - 1])
        {
            a[possibleIndex] = a[possibleIndex - 1];
            possibleIndex--;
        }
        a[possibleIndex] = temp;
    }
}
```

*sort runtime characteristics*

| sort | best case | worst case | notes |
|---|---|---|---|
| selection | n² | n² | runs the same number of comparisons regardless of input order |
| insertion | n | n² | fastest on already- (or nearly-) sorted input  -  inner `while` exits immediately |
| merge | n log n | n log n | always n log n; uses extra memory for the merge step |

*recursive method*
A method that calls itself.

*base case*
The condition that stops recursion (returns without recursing). Every recursive method needs at least one.

*recursive call*
The call the method makes to itself, usually with a "smaller" argument that moves toward a base case.

*infinite recursion*
A recursive method without a reachable base case. Eventually throws `StackOverflowError`.

*factorial  -  classic recursion*
```java
public static int factorial(int n)
{
    if (n == 0) return 1;          // base case
    else return n * factorial(n - 1);   // recursive call
}
```

*sum 1..n recursively*
```java
public static int sum(int n)
{
    if (n == 1) return 1;
    else return n + sum(n - 1);
}
```

*each call has its own locals*
Every recursive invocation gets its own copy of parameters and local variables on the call stack.

*recursion ↔ iteration*
Any recursive solution can be rewritten iteratively and vice versa. Recursion can hit a stack-size limit; iteration may need extra data structures.

*writing recursive code is out of scope*
You only need to **trace** recursive code on the AP exam, not write it from scratch.

*tracing recursion*
Substitute the argument into the body, follow the recursive call to its returned value, then combine. Work outward from the base case.
```java
factorial(3)
= 3 * factorial(2)
= 3 * (2 * factorial(1))
= 3 * (2 * (1 * factorial(0)))
= 3 * (2 * (1 * 1))
= 6
```

*recursive binary search*
```java
public static int bSearch(int[] a, int lo, int hi, int target)
{
    if (lo > hi) return -1;
    int mid = (lo + hi) / 2;
    if (a[mid] == target) return mid;
    else if (target < a[mid]) return bSearch(a, lo, mid - 1, target);
    else return bSearch(a, mid + 1, hi, target);
}
```

*merge sort*
Recursive sort: split the array in half, recursively sort each half, then merge the two sorted halves into one sorted array. More efficient than selection/insertion on large data. A classic *divide and conquer* algorithm.

*identifying merge sort code*
- three methods: `mergeSort` (public entry), `mergeSortHelper` (recursive  -  splits range), `merge` (combines two sorted halves)
- `mergeSortHelper` recursively calls itself on the left half `[from, middle]` and right half `[middle+1, to]`, then calls `merge`
- uses an auxiliary `temp[]` array the same size as the input

*statement execution count for runtime comparison*
Count how many times key statements run as `n` grows to compare algorithms informally. Linear search ~ `n`; binary search ~ `log n`; selection/insertion sort ~ `n²`; merge sort ~ `n log n`.

## Java Quick Reference Recap

*Math (`java.lang.Math`)*
- `int Math.abs(int)`, `double Math.abs(double)`
- `double Math.pow(double, double)`
- `double Math.sqrt(double)`
- `double Math.random()`  -  `[0.0, 1.0)`

*String (`java.lang.String`)*
- `new String(String)`
- `int length()`
- `String substring(int from, int to)`  -  chars `[from, to)`
- `String substring(int from)`  -  `substring(from, length())`
- `int indexOf(String)`  -  first index, or `-1`
- `boolean equals(String)`
- `int compareTo(String)`  -  `<0`, `0`, `>0`

*Integer / Double (`java.lang`)*
- `Integer.MIN_VALUE`, `Integer.MAX_VALUE`
- `static int Integer.parseInt(String)`
- `static double Double.parseDouble(String)`

*ArrayList<E> (`java.util`)*
- `int size()`
- `boolean add(E)`
- `void add(int, E)`
- `E remove(int)`
- `E get(int)`
- `E set(int, E)`

*Scanner (`java.util`)*
- `new Scanner(File)`
- `int nextInt()`, `double nextDouble()`, `boolean nextBoolean()`
- `String next()`, `String nextLine()`
- `boolean hasNext()`
- `void close()`

*File (`java.io`)*
- `new File(String pathname)`
- methods that read files must declare `throws IOException`

*String.split (`java.lang.String`)*
- `String[] split(String del)`

## Common Exceptions Cheatsheet

| exception | thrown when |
|---|---|
| `ArithmeticException` | integer division/mod by 0 |
| `NullPointerException` | calling a method on / dereferencing `null` |
| `ArrayIndexOutOfBoundsException` | array index `< 0` or `>= length` |
| `IndexOutOfBoundsException` | bad String or ArrayList index |
| `StringIndexOutOfBoundsException` | bad String index (subtype of `IndexOutOfBoundsException`) |
| `NumberFormatException` | `parseInt` / `parseDouble` on a non-numeric string |
| `InputMismatchException` | `Scanner.nextInt` etc. when input isn't that type |
| `IOException` / `FileNotFoundException` | file open/read error |
| `ClassCastException` | bad reference cast |
| `ConcurrentModificationException` | structurally modify a collection during enhanced-for traversal |
| `StackOverflowError` | infinite (or too-deep) recursion |
