import { Context } from "../internals/Context.ts";
import { registerNewFunction } from "./FunctionUtils";
import { interpret } from "../internals/Interpreter";
import { builtins } from "../middleware/Builtins.ts";

// Defining adds doesn't work, ie.   "+ = {s:set, item} => (new(set, entries(s) + item))",

export const standardLib = [
  "copies = {of, count:#} => (1..count -> (of))",
  "contains? = {lst:[], item} => (lst \\> (false, (item == @ | $), true))",
  "unique_add = {lst:[], (contains?(lst, item))} => (lst)",
  "unique_add = {lst:[], item} => (lst + item)",
  "unique = {lst:[]} => (lst \\> ([], (unique_add($,@))))",
  "is_whole? = {n:#} => (floor(n) == n)",
  "sum = {lst:[]} => (lst \\> (0, ($ + @)))",
  "min = {a:#, (a<=b):#} => (a)",
  "min = {_:#, b: #} => (b)",
  "min = {(len(lst) > 0):[]} => (lst \\> ((get(lst,0)), (?((@ < $), @, $))))",
  "max = {a:#, (a >= b):#} => (a)",
  "max = {_:#, b:#} => (b)",
  "max = {(len(lst) > 0):[]} => (lst \\> ((get(lst,0)), (?((@ > $), @, $))))",
  "slice = {lst:[], from:#} => (lst ~> (# >= from))",
  "in_range? = {target:#, (lower <= target):#, (target < higher):#} => true",
  "in_range? = {_:#, _:#, _: #} => false",
  "slice = {lst:[], from:#, to:#} => (lst ~> (in_range?(#, from, to)))",
  "head = {(len(lst) > 0):[]} => (get(lst,0))",
  "tail = {lst:[]} => (fast_slice(lst,1))",
  "set = {(unique(entries)):[]}",
  "halve = {lst:[]} => ([fast_slice(lst,0,floor(len(lst) / 2)), fast_slice(lst, floor(len(lst) / 2 ))])",
  "merge = {_:fn, [], l2:[]} => (l2)",
  "merge = {_:fn, l1:[], []} => (l1)",
  "merge = {compare:fn, l1:[], ((compare(get(l1,0),get(l2,0))) < 0):[]} => ((get(l1,0)) + (merge(compare,tail(l1),l2)))",
  "merge = {compare:fn, l1:[], l2:[]} => ((get(l2,0)) + (merge(compare, l1, tail(l2))))",
  "sort = {(len(lst) <= 1):[], _:fn} => (lst)",
  "sort_helper = {split_list:[], compare:fn} => (merge(compare,sort(get(split_list,0),compare), sort(get(split_list,1),compare)))",
  "sort = {lst:[], compare:fn} => (sort_helper(halve(lst), compare))",
  "compare = {n1:#,(n1 < n2):#} => -1",
  "compare = {n1:#,(n1 > n2):#} => 1",
  "compare = {_:#,_:#} => 0",
  "sort = {nums:[#]} => (sort(nums, compare))",
  "reverse = {lst:[]} => (lst -> (get(lst, len(lst) - # - 1)))",
  "sum = {str:string} => (str \\> (0, ($ + ord(@))))",
  "hash = {str:string, mod:#} => (sum(str) % mod)",
  "abs = {(a < 0):#} => (a * -1)",
  "abs = {a:#} => (a)",
  "all = {vs:[], mapper:fn} => (vs \\> (true,(mapper(@) & $)))",
  "any = {vs:[], mapper:fn} => (vs \\> (false, (mapper(@) | $)))",
  "reverse = {vs:[]} => (vs -> (get(vs, len(vs) - # - 1)))",
  "first = {vs:[]} => (get(vs,0))",
  "last = {vs:[]} => (get(vs, len(vs) - 1))",
  "time_diff = {result: []} => (last(result) - first(result))",
];

export const registerBuiltins = (ctx: Context, extraBuiltins?: any) => {
  const builtinReference = !!extraBuiltins ? extraBuiltins : builtins;
  for (const functionName of Object.keys(builtinReference)) {
    const patterns = builtinReference[functionName];
    for (const pattern of patterns) {
      registerNewFunction(functionName, ctx, pattern);
    }
  }

  // Only use text std lib if no extra builtins were supplied here
  if (!extraBuiltins) {
    for (const line of standardLib) {
      interpret(line);
    }
  }
};
