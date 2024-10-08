/** @vitest-environment jsdom */
/** @jsx createElement */
import {Router} from "../src";
import {beforeEach, describe, expect, test} from "vitest";
import {computed} from "data0";

type Handler = {
    title: string
}

describe('RxRouter based computed', () => {
    let router!: Router<Handler>

    beforeEach(()=> {
        router = new Router<Handler>([{
            path: '/f1',
            handler: {
                title: 'f1',
            }
        }, {
            path: '/f2',
            handler: {
                title: 'f2',
            }
        }])
    })


    test('basic computed', () => {
        router.add([{
            path: '/',
            redirect: '/f1'
        }])

        const SubRouter = router.derive('/f1')
        new SubRouter([{
            path: '/p1',
            handler: {
                title: 'p1'
            }
        }, {
            path: '/p2',
            handler: {
                title: 'p2'
            }
        }, {
            path : '/',
            redirect: '/p1'
        }])


        const title = computed(() => {
            const titleFrags = []
            let pointer: Router<Handler>|undefined = router
            while(pointer) {
                if (pointer.handler()) {
                    titleFrags.push(pointer.handler()!.title)
                    pointer = pointer.children.toArray().find(sub => sub.handler())
                } else {
                    break
                }
            }

            return titleFrags.join('|')
        })

        expect(title()).toBe('f1|p1')
        router.push('/f2')
        expect(router.handler()!.title).toBe('f2')
        expect(title()).toBe('f2')

        router.push('/f1/p2')
        expect(title()).toBe('f1|p2')
    })

    test('computed with dynamic added children', () => {
        const title = computed(() => {
            const titleFrags = []
            let pointer: Router<Handler>|undefined = router
            while(pointer) {
                if (pointer.handler()) {
                    titleFrags.push(pointer.handler()!.title)
                    pointer = pointer.children.toArray().find(sub => sub.handler())
                } else {
                    break
                }
            }

            return titleFrags.join('|')
        })
        router.push('/f1/p1')
        expect(title()).toBe('f1')

        const SubRouter =router.derive('/f1')
        new SubRouter([{
            path: '/p1',
            handler: {
                title: 'p1'
            }
        }])
        expect(title()).toBe('f1|p1')
    })

    test('computed with dynamic added redirect children', () => {
        const title = computed(() => {
            const titleFrags = []
            let pointer: Router<Handler>|undefined = router
            while(pointer) {
                if (pointer.handler()) {
                    titleFrags.push(pointer.handler()!.title)
                    pointer = pointer.children.toArray().find(sub => sub.handler())
                } else {
                    break
                }
            }

            return titleFrags.join('|')
        })
        router.push('/f1')
        expect(title()).toBe('f1')

        const SubRouter = router.derive('/f1')
        new SubRouter([{
            path: '/p1',
            handler: {
                title: 'p1'
            }
        }, {
            path: '/',
            redirect: '/p1'
        }])
        expect(title()).toBe('f1|p1')
    })

})