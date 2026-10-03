import { Component, input, output } from '@angular/core';
import { AccessPanel } from './access-panel';
import type { Version, VersionAction, VersionEvent } from './content.model';
import { RouteMap } from './route-map';
import { WorkflowTimeline } from './workflow-timeline';

/**
 * The "Workflow" tab of a content's detail, the same for every kind of content: the
 * editorial route of the selected version, its timeline and what the caller may do with
 * it. The three tell the same story from the version and its audit records; the route is
 * also where the caller acts on the version.
 */
@Component({
  selector: 'app-version-workflow',
  templateUrl: './version-workflow.html',
  imports: [AccessPanel, RouteMap, WorkflowTimeline],
})
export class VersionWorkflow {
  readonly version = input.required<Version<unknown>>();
  /** The history of the version, oldest first. */
  readonly events = input.required<readonly VersionEvent[]>();
  /** A transition is on its way: the route waits for it. */
  readonly busy = input(false);
  /** The caller asked to act on the version: edit it, or move it along the workflow. */
  readonly act = output<VersionAction>();
}
