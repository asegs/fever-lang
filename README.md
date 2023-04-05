_I've got a fever of a hundred and three._

## Fever: A Lisp From Your Wildest Dreams

#### Fever is a completely new type of programming language.  It is rather unfinished but it offers a glimpse into what a language unbound by convention can be.

### What is it?

Fever is a completely from scratch programming language.  It converts an expressive infix-friendly grammar to a lispy intermediate language which is then interpreted.
Fever strives for total self-consistency.  This comes primarily at the expense of performance.
There is a simple type system and heavy pattern matcher which work together to perform logic on the left side of expressions.

A large proportion of Fever's internals are implemented within the confines of its own type system and interpreter.

### What is it for?

Fever is for gasping in surprise and then diabolically laughing.

### Why do you call it Fever?

It came to me in a fever dream.


### How do I use it?
It works normally in a lot of ways.  Arithmetic and all should just work.  However, order of operations simply isn't respected.
Sorry, use parentheses.  Expressions are just evaluated in order.

You can visit the Sweat Lodge, an in-browser Fever REPL here:
https://asegs.github.io/fever-lang/interactives/playground.html

You can run it by cloning this repo and running `node fever.js` in the directory.  As arguments you may pass in additional Fever files to be run and loaded into scope in order, such as `node fever.js examples/std.fv`.

```js
1 + 2 //3

3 * 3 //9

3 + 3 * 10 //60?
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

You can apply higher order functions on lists as well.

```js
[1,2,3] -> (@ + 1) //[2,3,4] (@ refers to the current element)
[1,2,3] -> (@ + #) //[1,3,5] (# refers to the current index)
[1,2,3] -> (len(^)) //[0,1,2] (^ refers to the current list)

[1,2,3] ~> (# % 2 == 0) //[1,3] (The squiggly "dubious arrow" is a filter operator)
[1,2,3] \> (0, ($ + @)) //6 (This is a reduce.  The $ is the accumulator, the 0 is the starting value)
```

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
is_twenty = {20} => true
is_twenty = {n} => false

is_twenty(20) // true
is_twenty(19) //false
is_twenty("hello") //false
```

More specific patterns will be preferred over more generic ones in order of matching.
Functions can be called recursively.  You may need to go overboard on parentheses in times like these.
```js
fib = {0} => 0
fib = {1} => 1
fib = {n:number} => ((fib(n-1)) + (fib(n-2)))

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

coord_x(location) //1
coord_y(location) //2

second_location = new(coord,2,4)
location + second_location // (3,6)
```

One novel feature is implicit constructors.  You can define a normal signature like:

```js
set = {(unique(l)):[]}

item = new(set,[1,2,2]) //[1,2]
```

You can see that the given expression is applied to the argument before constructing the object.
Also, when you define single list types like this, they will be registered not as a typed tuple but as a named list type.
