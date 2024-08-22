import {describe, expect, test} from "vitest";
import {RxRecords} from "../src/index.js";
import {Atom, atom, computed} from "data0";

type Item = {
    id: number
    name: string
}

type ItemWithRandom = Item & { random: number }

describe('RxRemoteRecords', () => {
    // 10 个模拟数据
    const data = (new Array(100)).fill(1).map((_, index) => ({
        id: index,
        name: `name-${index}`
    })) as Item[]

    const getRemoteData = (offset: number, limit: number) : Promise<{id:number, name:string}[]> => {
        return new Promise<Item[]>((resolve) => {
            setTimeout(() => {
                resolve(data.slice(offset, limit+offset))
            }, 10)
        })
    }

    const getRemoteDataWithRandom = (offset: number, limit: number) : Promise<ItemWithRandom[]> => {
        return new Promise<ItemWithRandom[]>((resolve) => {
            setTimeout(() => {
                resolve(data.slice(offset, limit+offset).map(item => ({...item, random: Math.random()})))
            }, 10)
        })
    }




    test('get paged records', async () => {
        const pagination = atom({offset:0, limit:10})
        class SimpleRecord{
            static getId(item:Item) { return item.id}
            static async load(): Promise<Item[]> {
                const data = await getRemoteData(pagination().offset, pagination().limit)
                return data
            }
            get id(){ return this.raw.id}
            constructor(public raw: Item) {}
            update(newRecord: Item) {
                this.raw = newRecord
            }
        }
        const records = new RxRecords<Item>(SimpleRecord)
        await records.cleanPromise
        expect(records.data.map(i => i.raw)).toMatchObject((new Array(10)).fill(1).map((_, index) => ({
            id: index,
            name: `name-${index}`
        })))


        // 全新的数据
        pagination({offset: 10, limit: 20})
        await records.cleanPromise
        expect(records.data.map(i => i.raw)).toMatchObject((new Array(20)).fill(1).map((_, index) => ({
            id: 10+index,
            name: `name-${10+index}`
        })))

        // 头部新增，尾部删除
        pagination({offset: 5, limit: 15})
        await records.cleanPromise
        expect(records.data.map(i => i.raw)).toMatchObject((new Array(15)).fill(1).map((_, index) => ({
            id: 5+index,
            name: `name-${5+index}`
        })))

        // 头部删除，尾部新增
        pagination({offset: 15, limit: 15})
        await records.cleanPromise
        expect(records.data.map(i => i.raw)).toMatchObject((new Array(15)).fill(1).map((_, index) => ({
            id: 15+index,
            name: `name-${15+index}`
        })))

        // 头部删除，尾部删除
        pagination({offset: 20, limit: 5})
        await records.cleanPromise
        expect(records.data.map(i => i.raw)).toMatchObject((new Array(5)).fill(1).map((_, index) => ({
            id: 20+index,
            name: `name-${20+index}`
        })))

        // 头部新增，尾部新增
        pagination({offset: 15, limit: 15})
        await records.cleanPromise
        expect(records.data.map(i => i.raw)).toMatchObject((new Array(15)).fill(1).map((_, index) => ({
            id: 15+index,
            name: `name-${15+index}`
        })))
    })

    test('update records with partial update', async () => {
        const pagination = atom({offset:0, limit:10})
        class SimpleRecord {
            static getId(item:ItemWithRandom) { return item.id}
            static async load() {
                const data = await getRemoteDataWithRandom(pagination().offset, pagination().limit)
                return data
            }
            get id(){ return this.raw.id}
            random: Atom<number>
            constructor(public raw: ItemWithRandom) {
                this.random = atom(this.raw.random)
            }
            update(newRecord: ItemWithRandom) {
                this.raw = newRecord
                this.random(newRecord.random)
            }
        }
        const records = new RxRecords<ItemWithRandom>(SimpleRecord)

        let mapRuns = 0
        let internalRandomUpdateRuns = 0
        records.map(item => {
            mapRuns++
            return {
                id:item.id,
                computedRandom: computed(() => {
                    internalRandomUpdateRuns++
                    return item.random()
                })
            }
        })

        await records.cleanPromise
        expect(records.data.map(item =>({id:item.id, name:item.raw.name})))
            .toMatchObject((new Array(10)).fill(1).map((_, index) => ({
                id: index,
                name: `name-${index}`
            })))
        expect(mapRuns).toBe(10)
        expect(internalRandomUpdateRuns).toBe(10)


        // 全新的数据
        mapRuns = 0
        internalRandomUpdateRuns = 0
        pagination({offset: 10, limit: 20})
        await records.cleanPromise
        expect(records.data.map(item =>({id:item.id, name:item.raw.name})))
            .toMatchObject((new Array(20)).fill(1).map((_, index) => ({
                id: 10+index,
                name: `name-${10+index}`
            })))
        expect(mapRuns).toBe(20)
        expect(internalRandomUpdateRuns).toBe(20)


        // 头部新增，尾部删除
        mapRuns = 0
        internalRandomUpdateRuns = 0
        pagination({offset: 5, limit: 15})
        await records.cleanPromise
        expect(records.data.map(item =>({id:item.id, name:item.raw.name})))
            .toMatchObject((new Array(15)).fill(1).map((_, index) => ({
                id: 5+index,
                name: `name-${5+index}`
            })))
        // 新增了 5，更新了 10
        expect(mapRuns).toBe(5)
        expect(internalRandomUpdateRuns).toBe(15)

        // 头部删除，尾部新增
        mapRuns = 0
        internalRandomUpdateRuns = 0
        pagination({offset: 15, limit: 15})
        await records.cleanPromise
        expect(records.data.map(item =>({id:item.id, name:item.raw.name})))
            .toMatchObject((new Array(15)).fill(1).map((_, index) => ({
                id: 15+index,
                name: `name-${15+index}`
            })))
        // 为新增了 10，更新了5
        expect(mapRuns).toBe(10)
        expect(internalRandomUpdateRuns).toBe(15)

        // 头部删除，尾部删除
        mapRuns = 0
        internalRandomUpdateRuns = 0
        pagination({offset: 20, limit: 5})
        await records.cleanPromise
        expect(records.data.map(item =>({id:item.id, name:item.raw.name})))
            .toMatchObject((new Array(5)).fill(1).map((_, index) => ({
                id: 20+index,
                name: `name-${20+index}`
            })))
        // 为新增了 10，更新了5
        expect(mapRuns).toBe(0)
        expect(internalRandomUpdateRuns).toBe(5)

        // 头部新增，尾部新增
        mapRuns = 0
        internalRandomUpdateRuns = 0
        pagination({offset: 15, limit: 15})
        await records.cleanPromise
        expect(records.data.map(item =>({id:item.id, name:item.raw.name})))
            .toMatchObject((new Array(15)).fill(1).map((_, index) => ({
                id: 15+index,
                name: `name-${15+index}`
            })))
        expect(mapRuns).toBe(10)
        expect(internalRandomUpdateRuns).toBe(15)
    })

    test('group records', async () => {
        const pagination = atom({offset:0, limit:10})
        class SimpleRecord{
            static getId(item:Item) { return item.id}
            static async load(): Promise<Item[]> {
                const data = await getRemoteData(pagination().offset, pagination().limit)
                return data
            }
            get id(){ return this.raw.id}
            constructor(public raw: Item) {}
            update(newRecord: Item) {
                this.raw = newRecord
            }
        }


        const records = new RxRecords<Item>(SimpleRecord)
        const grouped = records.groupBy(item => item.id % 2)
        expect(grouped.get(0)).toBeUndefined()

        await records.cleanPromise
        expect(records.data.map(i => i.raw)).toMatchObject((new Array(10)).fill(1).map((_, index) => ({
            id: index,
            name: `name-${index}`
        })))

        expect(grouped.get(0)!.length()).toBe(5)
        expect(grouped.get(1)!.length()).toBe(5)

    })
})