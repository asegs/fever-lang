_I've got a fever of a hundred and three._

## Fever: A Lisp From Your Wildest Dreams

#### Fever is a completely new type of programming language.  It offers a glimpse into what a language unbound by convention can be.

### What is it?

Fever is a completely from scratch programming language, not based on any other.  It's interpreted, functional, declarative, intuitive, unintuitive, and different.
Fever strives for total self-consistency.  This comes primarily at the expense of performance.
There is a simple type system and heavy pattern matcher which work together to perform logic on the left side of expressions.

A large proportion of Fever's internals are implemented within the confines of its own type system and interpreter.

### What is it for?

Fever is for gasping in surprise and then diabolically laughing.  It has an application for teaching programming, with its minimal and natural functional elements.

### Why do you call it Fever?

It came to me in a fever dream.


### How do I use it?
Fever tries to do exactly what you might imagine it would when you look at its code.

You can run it by cloning this repo and running `tsx Fever.ts` in the directory.  As arguments you may pass in additional Fever files to be run and loaded into scope in order, such as `tsx Fever.ts examples/std.fv`.  `ts-node` or any other Typescript runner works as well.

#### Expressions
```js
1 + 2 //3

3 * 3 //9

3 + 3 * 10 //33
```

Variables can be assigned with the `=` operator (a function).
```js
a = 3 //3
a * 8 //24
```

You can make lists as well.
```js
[1,2,3] //[1,2,3]
1..5 //[1,2,3,4,5]
5..3 //[5,4,3]
[1,2,a] //[1,2,3]
```

And tuples.
```js
(1,2,3) //(1,2,3)
(1,2,(3 + 5)) //(1,2,8)
("hello", "world", 10, [1,2,3], (4,5,6)) //("hello", "world", 10, [1,2,3], (4,5,6))

```

You can also make expressions which are evaluated if they have no mysteries.
```js
(1 + 5) //6
(a + 5) //8
(n + 5) // "+(n,5)" (this is the parsed s-expression)
```

#### Higher Order Functions

You can apply higher order functions on lists as well.

```js
[1,2,3] -> (@ + 1) //[2,3,4] (@ refers to the current element)
[1,2,3] -> (@ + #) //[1,3,5] (# refers to the current index)
[1,2,3] -> (len(^)) //[0,1,2] (^ refers to the current list)

[1,2,3] ~> (# % 2 == 0) //[1,3] (The squiggly "dubious arrow" is a filter operator)
[1,2,3] \> (0, ($ + @)) //6 (This is a reduce.  The $ is the accumulator, the 0 is the starting value)
```

#### Functions and Patterns

You can define your own functions too.

```js
add = {a, b} => (a + b)
add(1,2) //3
```

You can add types to the signature as well.

```js
add = {a:number, b:number} => (a + b)
add(1,2) //3
add("hello", "world") //No satisfactory match for add.
```

Types are not strictly enforced but they are used to perform pattern matching.

Values can also be used to pattern match.

```js
is_twenty? = {20} => true
is_twenty? = {n} => false

is_twenty?(20) // true
is_twenty?(19) //false
is_twenty?("hello") //false
```

More specific patterns will be preferred over more generic ones in order of matching.
Functions can be called recursively.
```js
fib = {0} => 0
fib = {1} => 1
fib = {n:number} => (fib(n-1) + fib(n-2))

fib(1) //1
fib(0) //0
fib(2) //1
fib(5) //5
0..10 -> (fib(@)) //[0,1,1,2,3,5,8,13,21,34,55]
fib(-1) //Oops!
```

Let's see if we can catch that last case.
```js
fib = {(a < 0)} => false
```

Function signatures can also be self-referential.  For example:
```js
is_equal = {_,_} => false
is_equal = {a, a} => true
is_equal(1,2) //false
is_equal(1,1) //true
```

This works for expressions in signatures as well:
```js
is_double = {_,_} => false
is_double = {n, (n * 2)} => true
is_double(1,1) //false
is_double(1,2) //true
```

Pretty cool!

#### Types

While types can be inferred, Fever supports nominal typing derived from named tuples.
You can instantiate a type with the `new` function.

Getters are also generated.

In general, if no specific method is declared for something that operates on tuples, we recursively call that method on the tuple.

```js
coord = {x:number, y:number}
location = new(coord,1,2) //(1,2)

f = {_:coord} => true
f = {_} => false

f(location) //true
f((1,2)) //false

x(location) //1
y(location) //2

second_location = new(coord,2,4)

// This is now deprecated.  You'll have to write an add function yourself.
location + second_location // (3,6)
```

One novel feature is implicit constructors.  You can define a normal signature like:

```js
set = {(unique(l)):[]}

item = new(set,[1,2,2]) //[1,2]
```

You can see that the given expression is applied to the argument before constructing the object.
Also, when you define single list types like this, they will be registered not as a typed tuple but as a named list type.

#### Generics
Fever supports a very simple generics implementation.  Unknown types are considered generic at function definition time.
Once the function is called, they are realized and assigned to that value during evaluation of that function.
During invocation of the function, the generics are available as type variables.

```js
types_match = {a:T, b:T} => true
types_match = {_,_} => false

types_match(1,2) //true
types_match(1,"hello") //false

get_type = {_:T} => (T)
```

Generics can occur in the same type clause.  For example:
```js
f = {x:(T,T)} => ...
g = {x:(T,S,T), y:S} => ...
h = {x:T, xs:[T]} => ...
```

#### Morphisms

Fever supports "morphisms" (loosely based on the real thing) which automatically convert types into matching ones via a predefined function if a path can be found.
They are registered in a global morphism table using the morph function.

```js
bool_to_int = {true} => 1
bool_to_int = {false} => 0

morph(bool_to_int, boolean, number)

f = {x:#} => (x + 1)

f(true) //2
f(false) //1
```

Morphisms are considered increasingly treacherous as they require a farther path to the given type, so a longer morphism chain is worth less in a pattern match than a short one.

#### Syntax Tricks

Fever has a few novel syntax features.  One common one is the inclusion of non-alphanumeric characters in variables and function names.  For example:
```js
contains?([1,2,3],3) //true
+ = {a:my_type, b:my_type} => ... //overrides the add function for a given type
quit!(code)
```

Fever also supports universal function call syntax (UFCS) in which each function can be called as a method.
```js
[1,2,3].contains?(3) //true
3.square() //9
5.plus(3).times(2) //16, methods are chained sequentially
f(x).g()
```

Method calls effectively have the highest operator precedence and will always be grouped first, before any reordering.

Fever also supports whitespace-ignoring multiline functions.  The last line is returned.

```js
f = {x} => (
    y = x * 2
    x * y
)
```


