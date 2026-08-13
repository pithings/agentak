import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

import CatalogView from "./views/catalog-view.vue";

export const routes: RouteRecordRaw[] = [
  { path: "/", name: "catalog", component: CatalogView },
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
