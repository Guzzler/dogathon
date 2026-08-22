import { useNavigate } from "react-router-dom";
import { CarePlan } from "../../carePlan/CarePlan";

export function CarePlanView() {
  const navigate = useNavigate();
  return <CarePlan onExit={() => navigate("/")} />;
}
