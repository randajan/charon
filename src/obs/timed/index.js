import { TimeoutObserver } from "./observer/TimeoutObserver.js";
import { TimeoutContext } from "./contexts/TimeoutContext";
import { SingleTimeoutContext } from "./contexts/SingleTimeoutContext";
import { MultiTimeoutContext } from "./contexts/MultiTimeoutContext";

export default TimeoutObserver;

export {
    TimeoutObserver,
    TimeoutContext,
    SingleTimeoutContext,
    MultiTimeoutContext,
}