import {RxList} from "data0";

export type RecordType ={
    id?: any
    update: (newRecord: any, index: number) => any
    [k:string]: any
}

export interface RecordConstructor<T> {
    getId: (raw:T) => any
    load: (...args:any[]) => Promise<T[]>
    new (raw:T, ...rest: any[]): RecordType
}

// TODO 增加基于页码的缓存？
// TODO 增加基于 list/feild 的轮询 watch ?
// TODO 支持本地数据的插入？无 id？
export class RxRecords<T, U extends RecordConstructor<T> = RecordConstructor<T>> extends RxList<InstanceType<U>> {
    constructor(public RecordClass: U, ...contextArgs: any[]) {
        super(async () => RecordClass.load(...contextArgs))
    }
    replaceData(newData: T[]) {
        // 1. 对于常见在头尾增删的的情况，应该保持最高性能
        // 2. 对于每次都可能伦旭的情况。 也应该保持最高性能
        const oldIds = new Set(this.data.map(record => record.id))
        const newIds = new Set(newData.map(raw => this.RecordClass.getId(raw)))
        let oldIndex = 0
        let newIndex = 0
        let oldRecord:InstanceType<U>|undefined = undefined
        let newRawData:T|undefined = undefined
        while(true) {
            oldRecord = this.data[oldIndex]
            newRawData = newData[newIndex]
            if (!oldRecord && !newRawData) break

            // 说明是本地数据，直接跳过
            if (oldRecord && oldRecord.id === undefined) {
                oldIndex++
                continue
            }

            if (newRawData && oldRecord) {
                const oldId = oldRecord.id
                const newId = this.RecordClass.getId(newRawData)
                if (newId === oldId) {
                    oldRecord.update(newRawData, oldIndex)
                    oldIndex++
                    oldRecord = this.data[oldIndex]
                    newIndex++
                } else {
                    // 1. 优先识别删除的情况，不然后面的算法难写
                    if (!newIds.has(oldId)) {
                        this.splice(oldIndex, 1)
                        oldRecord = this.data[oldIndex]
                    } else {
                        // 2. newIds 也有 old Id，那么在当前位置，肯定是有新的插入，或者把后面的换到前面来了。
                        if (!oldIds.has(newId)) {
                            // 2.1. 如果没有 oldId，那么就是新的插入
                            this.splice(oldIndex, 0, new this.RecordClass(newRawData) as InstanceType<U>)
                            // oldIndex 前进一位，但实际还是指向的当前没处理的对象
                            oldIndex++
                            // newIndex 前进1位指向下一个
                            newIndex++
                        } else {
                            // 2.2. 如果有 oldId，那么就是后面的换到前面来了。
                            const originIndex = this.data.findIndex(record => record.id === newId)
                            const originOldRecord = this.splice(originIndex, 1)[0]
                            // 先删掉原来的位置，再插入到新的位置
                            this.splice(originIndex, 1 )
                            this.splice(oldIndex, 0, originOldRecord)
                            oldIndex++
                            newIndex++
                        }
                    }
                }
            } else if (newRawData) {
                // 3. 如果 oldRecord 不存在，那么就是新的插入
                this.push(new this.RecordClass(newRawData) as InstanceType<U>)
                oldIndex++
                newIndex++
            } else {
                // 4. 如果 newRecord 不存在但 oldRecord 还有，直接删了，
                //  继续循环，这里不能直接全部删是因为后面可能还有无 id 的本地数据，
                //  所还是继续利用这个循环。
                this.splice(oldIndex, 1)
            }
        }
        // 3. 在重排序的情况下，有两种情况：
        // 3.1. 如果需要排序动画，那么换位置的元素一定要保留在 dom 上，所以智能更新 attribute 上的位置信息，由外部框架再去实现排序和动画。
        // 3.2. 如果不需要排序动画，那么直接替换整个列表即可。
        //  重排序不在这里处理了，因为是动画需求，所以在 axii 中再去处理。
    }
}
