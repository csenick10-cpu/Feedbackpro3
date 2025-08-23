"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { FeedbackForm } from "@/components/feedback-form"
import { FeedbackSubmissions } from "@/components/feedback-submissions"
import { Plus, Settings, Copy, ExternalLink, Download } from "lucide-react"

export default function FeedbackPage() {
  const [activeTab, setActiveTab] = useState("forms")

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Feedback Portal</h2>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create New Form
          </Button>
        </div>

        <Tabs defaultValue="forms" className="space-y-4" onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="forms">Feedback Forms</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="forms" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>General Feedback</CardTitle>
                    <Badge>Active</Badge>
                  </div>
                  <CardDescription>General customer feedback form</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center justify-between py-1">
                      <span>Submissions</span>
                      <span className="font-medium">124</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span>Created</span>
                      <span className="font-medium">July 15, 2025</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span>Last submission</span>
                      <span className="font-medium">2 hours ago</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Product Feedback</CardTitle>
                    <Badge>Active</Badge>
                  </div>
                  <CardDescription>Product-specific feedback form</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center justify-between py-1">
                      <span>Submissions</span>
                      <span className="font-medium">87</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span>Created</span>
                      <span className="font-medium">July 22, 2025</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span>Last submission</span>
                      <span className="font-medium">5 hours ago</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Support Experience</CardTitle>
                    <Badge variant="outline">Draft</Badge>
                  </div>
                  <CardDescription>Post-support feedback form</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center justify-between py-1">
                      <span>Submissions</span>
                      <span className="font-medium">0</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span>Created</span>
                      <span className="font-medium">August 5, 2025</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span>Last edited</span>
                      <span className="font-medium">1 day ago</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </CardFooter>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Form Editor</CardTitle>
                <CardDescription>Edit the selected feedback form</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="form-name">Form Name</Label>
                    <Input id="form-name" defaultValue="General Feedback" />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="form-description">Description</Label>
                    <Textarea
                      id="form-description"
                      defaultValue="We value your feedback! Please let us know about your experience with our products and services."
                    />
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="form-status">Form Status</Label>
                      <Switch id="form-status" defaultChecked />
                    </div>
                    <p className="text-xs text-muted-foreground">Toggle to activate or deactivate this form</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Form Fields</Label>
                    <FeedbackForm />
                  </div>

                  <div className="grid gap-2">
                    <Label>Embed Code</Label>
                    <div className="relative">
                      <Input
                        readOnly
                        value='<iframe src="https://feedback.yourcompany.com/embed/general" width="100%" height="500" frameborder="0"></iframe>'
                      />
                      <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full" onClick={() => {}}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Copy this code to embed the feedback form on your website
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline">Cancel</Button>
                <Button>Save Changes</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Feedback Submissions</CardTitle>
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export Data
                  </Button>
                </div>
                <CardDescription>View and analyze customer feedback submissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 pb-4">
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Form" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Forms</SelectItem>
                      <SelectItem value="general">General Feedback</SelectItem>
                      <SelectItem value="product">Product Feedback</SelectItem>
                      <SelectItem value="support">Support Experience</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue="30d">
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Time Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Search submissions..." className="flex-1" />
                </div>
                <FeedbackSubmissions />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Feedback Portal Settings</CardTitle>
                <CardDescription>Configure your feedback portal settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="portal-name">Portal Name</Label>
                    <Input id="portal-name" defaultValue="Company Feedback Portal" />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="portal-url">Custom URL</Label>
                    <Input id="portal-url" defaultValue="feedback.yourcompany.com" />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="notification-email">Notification Email</Label>
                    <Input id="notification-email" type="email" defaultValue="feedback@yourcompany.com" />
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <Switch id="email-notifications" defaultChecked />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Receive email notifications for new feedback submissions
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-response">Auto-Response</Label>
                      <Switch id="auto-response" defaultChecked />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Send automatic thank you emails to customers who submit feedback
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="auto-response-message">Auto-Response Message</Label>
                    <Textarea
                      id="auto-response-message"
                      defaultValue="Thank you for your feedback! We appreciate you taking the time to share your thoughts with us. Your input helps us improve our products and services."
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline">Cancel</Button>
                <Button>Save Settings</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
