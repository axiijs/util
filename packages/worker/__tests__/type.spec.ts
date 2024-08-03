import {PromiseWrappedClass} from "../src";
import {assertType} from "vitest";


class A {
    m1() {

    }
}

type B = PromiseWrappedClass<A>

type KeysOfB = keyof B

assertType<'m1'>([] as unknown as KeysOfB)
