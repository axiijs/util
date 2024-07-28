/** @vitest-environment jsdom */
/** @jsx createElement */
import {RxRouter} from "../src/router";
import {beforeEach, describe, expect, test} from "vitest";
import {createBrowserHistory} from "history";
import {computed} from "data0";

type Handler = {
    title: string
}

describe('RxRouter based computed', () => {
    let router!: RxRouter<Handler>

    beforeEach(()=> {
        router = new RxRouter<Handler>([{
            path: '/f1',
            handler: {
                title: 'f1',
            }
        }, {
            path: 'f2',
            handler: {
                title: 'f2',
            }
        }, {
            path: 'f2',
            handler: {
                title: 'f2',
            }
        }], createBrowserHistory())


    })


    test('basic computed', () => {
        router.add([{
            path: '/',
            redirect: '/f1'
        }])

        router.derive('/f1').add([{
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
            let pointer: RxRouter<Handler>|undefined = router
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
        expect(title()).toBe('f2')

        router.push('/f1/p2')
        expect(title()).toBe('f1|p2')
    })

    test('computed with dynamic added children', () => {
        const title = computed(() => {
            const titleFrags = []
            let pointer: RxRouter<Handler>|undefined = router
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

        router.derive('/f1').add([{
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
            let pointer: RxRouter<Handler>|undefined = router
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

        router.derive('/f1').add([{
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