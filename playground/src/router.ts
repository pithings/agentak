import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

import HomeView from "./views/home-view.vue";

export const routes: RouteRecordRaw[] = [
  { path: "/", name: "home", component: HomeView },
  {
    path: "/components",
    name: "catalog",
    component: () => import("./views/catalog-view.vue"),
  },
  {
    path: "/demo",
    name: "demo",
    component: () => import("./views/demo-view.vue"),
  },
  {
    path: "/c/:name",
    name: "component",
    component: () => import("./views/component-view.vue"),
    props: true,
  },
  { path: "/:rest(.*)*", redirect: "/" },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  // A component page is its own screen; the catalog keeps where it was.
  scrollBehavior: (to, from, saved) => saved ?? (to.path === from.path ? false : { top: 0 }),
});
