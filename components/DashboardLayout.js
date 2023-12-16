import useBreakpoints from "@/utils/useBreakpoints";
import Sidebar, { useActiveTab } from "./Sidebar";
import NoSsr from "@mui/material/NoSsr";

const DashboardLayout = ({ renderChild = _renderChild, tabs }) => {
  const isWideScreen = useBreakpoints().lg;
  return (
    <div className="flex h-screen w-screen">
      <NoSsr>
        <Sidebar isStatic={isWideScreen} tabs={tabs} />
      </NoSsr>

      <main className="flex-grow  overflow-y-scroll">
        <ChooseLayout renderChild={renderChild} tabs={tabs} />
      </main>
    </div>
  );
};

const _renderChild = function (tab) {
  const Component = tab.component;
  return <Component />;
};

function ChooseLayout({ renderChild, tabs }) {
  const tab = useActiveTab(tabs);
  return renderChild(
    tabs.find((e) => tab === (e.id ?? e.name.toLowerCase())) ?? tabs[0]
  );
}
export default DashboardLayout;
