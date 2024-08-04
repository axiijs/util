/** @vitest-environment jsdom */
/** @jsx createElement */
import {
    Action,
    SerialAction,
    SingleAction,
    STATUS_ABORT,
    STATUS_PENDING,
    STATUS_PROCESSING,
    STATUS_SUCCESS
} from "../src";
import {beforeEach, expect, describe, test} from "vitest";
import {atom, Atom, RxList} from "data0";

function wait(time: number) {
    return new Promise(resolve => {
        setTimeout(resolve, time)
    })
}



describe('parallel', () => {
    let parallel!: Action<any>

    beforeEach(() => {
        parallel = new Action(async (...args: any[]) => {
            await wait(200)
            return args
        }, {
            parallelLimit: 3
        })
    })


    test('basic', async () => {
        const list = new RxList<{id:number, status:Atom<number>}>([])
        const pendingList = list.filter(item => item.status() === STATUS_PENDING)
        pendingList.length()
        const processingList = list.filter(item => item.status() === STATUS_PROCESSING)
        processingList.length()
        list.push({id:1, status:atom(STATUS_PENDING)})

        expect(pendingList.length.raw).toBe(1)
        expect(processingList.length.raw).toBe(0)

        pendingList.data.at(0)!.status(STATUS_PROCESSING)
        expect(pendingList.length.raw).toBe(0)
        expect(processingList.length.raw).toBe(1)

        processingList.data.at(0)!.status(STATUS_SUCCESS)
        expect(pendingList.length.raw).toBe(0)
        expect(processingList.length.raw).toBe(0)
    })

    test('parallel limit', async () => {
        const p1 = parallel.run(1,2)
        const p2 = parallel.run(2,3)
        const p3 = parallel.run(3,4)

        await wait(100)
        expect(p1.status.raw).toBe(STATUS_PROCESSING)
        expect(p2.status.raw).toBe(STATUS_PROCESSING)
        expect(p3.status.raw).toBe(STATUS_PROCESSING)

        await wait(200)
        expect(p1.status.raw).toBe(STATUS_SUCCESS)
        expect(p2.status.raw).toBe(STATUS_SUCCESS)
        expect(p3.status.raw).toBe(STATUS_SUCCESS)
        expect(p1.data.raw).toMatchObject([1,2])
        expect(p2.data.raw).toMatchObject([2,3])
        expect(p3.data.raw).toMatchObject([3,4])
    })

    test('beyond parallel limit should abort oldest', async () => {
        const p1 = parallel.run(1,2)
        const p2 = parallel.run(2,3)
        const p3 = parallel.run(3,4)

        expect(p1.status.raw).toBe(STATUS_PROCESSING)

        const p4 = parallel.run(4,5)
        await wait(10)
        expect(p1.status.raw).toBe(STATUS_ABORT)
        expect(p2.status.raw).toBe(STATUS_PROCESSING)
        expect(p3.status.raw).toBe(STATUS_PROCESSING)
        await wait(10)
        expect(p4.status.raw).toBe(STATUS_PROCESSING)

        await wait(200)
        expect(p2.status.raw).toBe(STATUS_SUCCESS)
        expect(p3.status.raw).toBe(STATUS_SUCCESS)
        expect(p4.status.raw).toBe(STATUS_SUCCESS)
    })
})

describe('serial', () => {
    let serial!: SerialAction<any>

    beforeEach(() => {
        serial = new SerialAction(async (...args: any[]) => {
            await wait(100)
            return args
        }, {})
    })

    test('serial limit', async () => {
        const p1 = serial.run(1,2)
        const p2 = serial.run(2,3)
        const p3 = serial.run(3,4)

        await wait(10)
        expect(p1.status.raw).toBe(STATUS_PROCESSING)
        expect(p2.status.raw).toBe(STATUS_PENDING)
        expect(p3.status.raw).toBe(STATUS_PENDING)

        await p1.resolvers.promise
        expect(p1.status.raw).toBe(STATUS_SUCCESS)

        await wait(10)
        expect(serial.pendingProcesses.length.raw).toBe(1)
        expect(serial.processingProcesses.length.raw).toBe(1)
        expect(serial.completedProcesses.length.raw).toBe(1)

        await p2.resolvers.promise
        await wait(10)
        expect(p2.status.raw).toBe(STATUS_SUCCESS)
        expect(p3.status.raw).toBe(STATUS_PROCESSING)

        await p3.resolvers.promise
        await wait(10)
        expect(p3.status.raw).toBe(STATUS_SUCCESS)
    })
})

describe('single', () => {
    let single!: SingleAction<any>

    beforeEach(() => {
        single = new SingleAction(async (...args: any[]) => {
            await wait(100)
            return args
        }, {})
    })

    test('single limit', async () => {
        const p1 = single.run(1,2)

        await wait(10)
        expect(p1.status.raw).toBe(STATUS_PROCESSING)
        const p2 = single.run(2,3)
        await wait(10)
        expect(p1.status.raw).toBe(STATUS_ABORT)

        await wait(10)
        expect(p2.status.raw).toBe(STATUS_PROCESSING)

        const p3 = single.run(3,4)
        await wait(10)
        expect(p2.status.raw).toBe(STATUS_ABORT)
        await wait(10)
        expect(p3.status.raw).toBe(STATUS_PROCESSING)

        await p3.resolvers.promise
        await wait(10)
        expect(p3.status.raw).toBe(STATUS_SUCCESS)


    })
})