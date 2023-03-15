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

You can run it by cloning this repo and running `node interpreter.js` in the directory.  Please note that this REPL is not up to spec yet and may have some rather offensive behavior.

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
[1,2,3] -> (^) //[[1,2,3],[1,2,3],[1,2,3]] (^ refers to the current list)

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

Pretty cool!
