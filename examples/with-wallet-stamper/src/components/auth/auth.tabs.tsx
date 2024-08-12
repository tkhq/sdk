import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthForm } from "./auth";

export function AuthTabs() {
  return (
    <Tabs defaultValue="signUp" className="w-[480px]">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="signUp">Sign Up</TabsTrigger>
        <TabsTrigger value="signIn">Sign In</TabsTrigger>
      </TabsList>
      <TabsContent value="signUp">
        <AuthForm isSignUp={true} />
      </TabsContent>
      <TabsContent value="signIn">
        <AuthForm isSignUp={false} />
      </TabsContent>
    </Tabs>
  );
}
