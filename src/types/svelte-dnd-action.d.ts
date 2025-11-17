declare module "svelte-dnd-action" {
  export {
    dndzone,
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    SHADOW_PLACEHOLDER_ITEM_ID,
    DRAGGED_ELEMENT_ID,
    SHADOW_ELEMENT_HINT_ATTRIBUTE_NAME,
    TRIGGERS,
    SOURCES,
    setDebugMode,
    setFeatureFlag,
    FEATURE_FLAG_NAMES,
    overrideItemIdKeyNameBeforeInitialisingDndZones,
    alertToScreenReader,
  } from "svelte-dnd-action/dist/index";

  export type {
    Item,
    Options,
    DndEventInfo,
    DndEvent,
  } from "svelte-dnd-action/dist/index";
}
