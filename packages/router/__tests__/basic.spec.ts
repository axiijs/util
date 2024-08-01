/** @vitest-environment jsdom */
/** @jsx createElement */
import {RxRouter} from "../src/router";
import {beforeEach, describe, expect, test} from "vitest";
import {createBrowserHistory} from "history";

type Handler = {
    title: string
}


describe('define', () => {
    test('define router', () => {
        const router = new RxRouter([{
            path: '/f1/p1',
            handler: 'f1p1'
        }, {
            path: '/f1/p2',
            handler: 'f1p2'
        }])
        expect(router.recognize('/f1/p2')!.handler).toBe('f1p2')
    })
})

describe('basic util', () => {
    let router!: RxRouter<Handler>

    beforeEach(() => {
        // @ts-ignore
        router = new RxRouter<Handler>(
            [{
                path: '/f1',
                handler: {
                    title: 'f1',
                }
            }, {
                path: 'f2',
                handler: {
                    title: 'f2',
                }
            }],
            // @ts-ignore
            createBrowserHistory()
        )
    })

    test('basic util with browser history', async () => {
        const location = window.location
        window.history.replaceState({}, "", '/f2')
        expect(location.pathname === '/f2')
        router.push('/f1')
        // expect(window.location.pathname === '/f1')
        expect(location.pathname === '/f1')
        expect(router.handler()).toMatchObject({title: 'f1'})

        router.push('/f2')
        expect(window.location.pathname === '/f2')
        expect(router.handler()).toMatchObject({title: 'f2'})
    })

    test('with sub router', () => {
        // window.history.pushState({}, '', '/f1')
        const subRouter = router.derive('/f1')
        subRouter.add([{
            path: '/p1',
            handler: {
                title: 'p1'
            }
        }, {
            path: 'p2',
            handler: {
                title: 'p2'
            }
        }])

        // 使用 1 级可以修改
        router.push('/f1/p1')
        expect(window.location.pathname === '/f1/p1')
        expect(router.handler()).toMatchObject({title: 'f1'})
        expect(subRouter.handler()).toMatchObject({title: 'p1'})

        // 使用 2 级可以修改
        subRouter.push('/p2')
        expect(window.location.pathname === '/f1/p2')
        expect(router.handler()).toMatchObject({title: 'f1'})
        expect(subRouter.handler()).toMatchObject({title: 'p2'})

        // 2 级使用 push //
        subRouter.push('//f2')
        expect(window.location.pathname === '/f2')
        expect(router.handler()).toMatchObject({title: 'f2'})
        expect(subRouter.handler()).toBeUndefined()

        // 任何使用 redirect 的 route 一定是 exact match
        subRouter.redirect('/f1/p1')
        expect(window.location.pathname === '/f1/p1')
        expect(router.handler()).toMatchObject({title: 'f1'})
        expect(subRouter.handler()).toMatchObject({title: 'p1'})
    })

    test('redirect', () => {
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
            path: '/',
            redirect: '/p1'
        }])

        router.push('/')
        expect(window.location.pathname === '/f1/p1')
        expect(router.handler()).toMatchObject({title: 'f1'})

        router.push('/f2')
        expect(window.location.pathname === '/f2')
        expect(router.handler()).toMatchObject({title: 'f2'})

        // TODO 应该会挂
        router.push('/f1')
        expect(window.location.pathname === '/f1/p1')
        expect(router.handler()).toMatchObject({title: 'f1'})
    })

    test('add child router with redirect dynamically', () => {

        router.push('/f1')
        expect(window.location.pathname === '/f1')
        expect(router.handler()).toMatchObject({title: 'f1'})

        const subRouter = router.derive('/f1')
        subRouter.add([{
            path: '/',
            redirect: '/p1'
        }])

        expect(window.location.pathname === '/f1/p1')
    })

    test('add child router with handler', () => {
        router.push('/f1/p1')
        expect(window.location.pathname === '/f1')
        expect(router.handler()).toMatchObject({title: 'f1'})

        const subRouter = router.derive('/f1')
        subRouter.add([{
            path: '/p1',
            handler: {
                title: 'p1'
            }
        }])

        expect(window.location.pathname === '/f1/p1')
        expect(subRouter.handler()).toMatchObject({title: 'p1'})
    })
})
