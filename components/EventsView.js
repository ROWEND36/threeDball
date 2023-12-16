import sentenceCase from "@/utils/sentenceCase";

import {
  default as Table,
  supplyHeader,
  addHeaderClass,
  addClassToColumns,
  supplyValue,
} from "@/components/Table";
import styles from "./events_view.module.css";
import { range } from "d3";
import { formatTime } from "@/utils/formatNumber";
import LoaderAnimation from "@/components/LoaderAnimation";
import { daysToMs } from "@/utils/time_utils";
import { useQuery } from "@/models/lib/query";
import Events from "@/models/event";
import Card1 from "./Card1";
import { Box, Divider, Typography } from "@mui/material";

const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const days = ["sun", "mon", "tue", "wed", "thur", "fri", "sat"];
function EventsView({ date = new Date() }) {
  /**
   * @type {{data: import("@/models/event").Event[]}}
   */
  const { data: events } = useQuery(() => Events.all(), [], { watch: true });
  const startOfDay = new Date(date.getTime());
  startOfDay.setHours(0, 0, 0, 0);
  const currentMonth = sentenceCase(months[date.getMonth()]);
  const currentYear = date.getFullYear();
  return (
    <Card1
      className="w-96 mx-2 flex-grow-0 my-6 scroll-primary py-2"
      boxClass="h-full px-6 py-5 2xl:py-6 max-h-80 overflow-y-auto"
      sx={{ backgroundColor: "primary.dark", color: "white" }}
    >
      <Typography variant="h5">Upcoming Events</Typography>
      <Typography variant="caption" color="text.disabledOnPrimaryDark">
        Date
      </Typography>
      <div className="mb-2 flex flex-wrap">
        <Typography variant="body1">
          {currentMonth} {currentYear}
        </Typography>
      </div>
      <WeekView date={date} />
      <Divider sx={{ backgroundColor: "gray.dark", my: 2 }} />
      <ul>
        {events ? (
          events.length === 0 ? (
            <Typography sx={{ textAlign: "center", py: 4 }}>
              No upcoming events
            </Typography>
          ) : (
            events
              .filter((e) => e.date >= startOfDay)
              .filter((e) => e.date <= startOfDay.getTime() + daysToMs(100))
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .map(({ date, title, scope }, i) => (
                <EventView
                  key={i}
                  date={date}
                  title={title}
                  scope={scope}
                  isSelected={i == 0}
                />
              ))
          )
        ) : (
          <LoaderAnimation small light />
        )}
      </ul>
    </Card1>
  );
}
/**
 * @param {Date} props.date
 * @param {Boolean} props.showHeader
 * @param {Object} props
 */
const WeekView = ({ date }) => {
  const day = date.getDay();
  const firstDay = date.getDate() - day;
  const lastMonth = date.getMonth(); /* - 1 + 1*/
  const clamp = (e) =>
    e > 0
      ? e
      : e +
        (lastMonth === 9 ||
        lastMonth === 4 ||
        lastMonth === 6 ||
        lastMonth === 11
          ? 30
          : lastMonth === 2
          ? date.getFullYear() % 4 === 0
            ? 29
            : 28
          : 31);

  return (
    <Table
      cols={7}
      rows={1}
      className="w-full leading relative -left-2"
      headerClass=""
      renderHooks={[
        supplyHeader((col) => sentenceCase(days[col])),
        addHeaderClass(`text-center text-disabled ${styles["week-header"]}`),
        addClassToColumns("text-center", range(7)),
        supplyValue((row, col) => (
          <Box
            as="span"
            sx={{
              backgroundColor: col === day ? "primary.light" : "transparent",
            }}
            className={`inline-block ${
              col === day
                ? "w-8 h-8 inline-flex items-center justify-center rounded-full"
                : ""
            }`}
          >
            {clamp(firstDay + col)}
          </Box>
        )),
      ]}
    />
  );
};

const EventView = ({ date, title, scope, isSelected }) => {
  const day = sentenceCase(days[date.getDay()]);
  const monthDate = date.getDate();
  const time = formatTime(date).toLowerCase();
  const toScopeString = (scope) => {
    let mask = Object.keys(scope).filter((e) => scope[e]);
    return mask.length === 0
      ? "No users selected"
      : "All " +
          (mask.length === 1
            ? mask[0]
            : mask.slice(0, -1).join(", ") + " and " + mask[mask.length - 1]);
  };
  return (
    <Box
      className={`flex rounded px-4 items-center my-2 pb-4`}
      sx={{
        backgroundColor: isSelected ? "primary.light" : "transparent",
        py: isSelected ? 1 : 0,
      }}
    >
      <Box
        className={`text-center w-16 flex-shrink-0 mr-4 mt-2 py-2 rounded-md flex flex-col items-center justify-center`}
        sx={{
          backgroundColor: isSelected ? "transparent" : "primary.light",
        }}
      >
        <Typography paragraph sx={{ color: "primary.dark", my: 0 }}>
          {day}
        </Typography>
        <Typography className="font-bold leading-none my-0" variant="h3">
          {monthDate}
        </Typography>
      </Box>
      <div className="w-0 flex-grow mt-2">
        <Typography
          variant="h4"
          className="font-thin text-white leading-normal w-auto overflow-hidden whitespace-nowrap text-ellipsis"
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          className={`mt-0 mb-2`}
          sx={{
            color: isSelected ? "primary.dark" : "text.disabled",
          }}
        >
          {toScopeString(scope)}
        </Typography>
        <Typography
          component="span"
          className="rounded p-1"
          sx={{
            backgroundColor: isSelected ? "white" : "primary.light",
            color: isSelected ? "primary.dark" : null,
          }}
        >
          {time}
        </Typography>
      </div>
    </Box>
  );
};

export default EventsView;
